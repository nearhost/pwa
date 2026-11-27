import { expect, test } from '@playwright/test';
import { envelope, fakeApi } from './fake-api.js';
import { canvas, project } from './fixtures.js';
import { schemes, sizes } from './sizes.js';

for (const size of sizes) {
  for (const scheme of schemes) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme });
      const landscape = size.viewport.width >= 1024;

      test('lists the projects grouped by machine, this machine first', async ({ page }) => {
        await fakeApi(page, { state: canvas });
        await page.goto('/');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 2 })).toHaveText(['leto', 'build-box']);
        const leto = main.getByRole('region', { name: 'leto' });
        await expect(leto.getByRole('heading', { level: 3 })).toHaveText([
          'admin',
          'docs-site',
          'storefront',
        ]);
        await expect(leto).toContainText('this machine · 2 running');
        const box = main.getByRole('region', { name: 'build-box' });
        await expect(box.getByRole('heading', { level: 3 })).toHaveText(['api', 'worker']);
        await expect(box).toContainText('waiting for port 9000 to answer');

        // Open in browser goes to the network address, in a new tab.
        const open = main.getByRole('link', { name: 'Open storefront in the browser' });
        await expect(open).toHaveAttribute('href', 'https://storefront.lab.example.dev');
        await expect(open).toHaveAttribute('target', '_blank');

        // Search filters by name.
        await main.getByRole('searchbox', { name: 'Filter projects' }).fill('OR');
        await expect(main.getByRole('heading', { level: 3 })).toHaveText(['storefront', 'worker']);
        await main.getByRole('searchbox', { name: 'Filter projects' }).fill('nothing');
        await expect(main).toContainText('No project matches');
      });

      test('the sections: waiting for you with its count, documents, this machine', async ({
        page,
      }) => {
        await fakeApi(page, {
          state: {
            ...canvas,
            approvals: [{ id: 'a1', proposal: { Name: 'billing' } }] as never,
          },
        });
        await page.goto('/');
        const nav = landscape
          ? page.getByRole('navigation', { name: 'Nearhost' })
          : page.getByRole('navigation', { name: 'Sections' });
        await expect(nav).toBeVisible();
        const waiting = nav.getByRole('link', { name: /Waiting/ });
        await expect(waiting).toContainText('1');
        await expect(nav.getByRole('link', { name: /Documents/ })).toHaveAttribute(
          'href',
          '/documents',
        );
        await expect(nav.getByRole('link', { name: /machine/i })).toHaveAttribute(
          'href',
          '/machine',
        );
        await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute(
          'aria-current',
          'page',
        );
        // What waits is on the overview too, with a link to answer it.
        await expect(
          page.locator('main').getByRole('link', { name: /An agent wants to add billing/ }),
        ).toHaveAttribute('href', '/approve/a1');
      });

      test('start is disabled while it is asked, then the card follows the event', async ({
        page,
      }) => {
        const api = await fakeApi(page, { state: canvas });
        let answer: (() => void) | undefined;
        api.on(
          'POST /api/v1/projects/admin/start',
          () => new Promise((resolve) => (answer = () => resolve({ status: 204 }))),
        );
        await page.goto('/');
        await expect(page.locator('[data-connection]')).toHaveText('Live');
        const start = page.locator('main').getByRole('button', { name: 'Start admin' });
        await start.click();
        await expect(start).toBeDisabled();
        await expect.poll(() => answer !== undefined).toBe(true);
        answer!();
        await api.send(
          envelope(2, {
            event: {
              Time: '',
              Project: 'admin',
              Server: '',
              State: 'running',
              Message: 'state: running',
            },
          }),
        );
        const card = page.locator('main').getByRole('article', { name: 'admin' });
        await expect(card).toContainText('Running');
        await expect(card.getByRole('button', { name: 'Stop admin' })).toBeEnabled();
        expect(api.requests.filter((r) => r.method === 'POST').map((r) => r.path)).toEqual([
          '/api/v1/projects/admin/start',
        ]);
      });

      test('a start the core refuses says why, and the button comes back', async ({ page }) => {
        const api = await fakeApi(page, { state: canvas });
        api.on('POST /api/v1/projects/admin/start', () => ({
          status: 409,
          body: { error: 'x', title: 'admin is already starting', status: 409 },
        }));
        await page.goto('/');
        const card = page.locator('main').getByRole('article', { name: 'admin' });
        await card.getByRole('button', { name: 'Start admin' }).click();
        await expect(card.getByRole('alert')).toHaveText('admin is already starting');
        await expect(card.getByRole('button', { name: 'Start admin' })).toBeEnabled();
      });

      test('when the machine cannot be reached, actions are off and say why', async ({ page }) => {
        const api = await fakeApi(page, { state: canvas });
        await page.goto('/');
        const main = page.locator('main');
        await expect(main.getByRole('button', { name: 'Start admin' })).toBeEnabled();
        api.on('GET /api/v1/state', () => ({ status: 502, body: { title: 'Bad', status: 502 } }));
        await api.drop();
        await expect(main.getByRole('button', { name: 'Start admin' })).toBeDisabled();
        await expect(main.getByRole('button', { name: 'Stop storefront' })).toBeDisabled();
        await expect(main).toContainText(/Can't reach leto\. This is what it said at/);
        // The projects stay listed, as they were last seen.
        await expect(main.getByRole('heading', { level: 3, name: 'storefront' })).toBeVisible();
      });

      test('with nothing served, the empty state shows how to add a project', async ({ page }) => {
        await fakeApi(page, { state: { projects: {}, sites: {} } });
        await page.goto('/');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 2 })).toHaveText(
          'Nothing is served on leto yet',
        );
        await expect(main).toContainText('/nearhost add');
        await expect(main.getByRole('button', { name: /Add project/ })).toBeDisabled();
        await expect(main.getByRole('button', { name: /Add a server/ })).toBeDisabled();
        await expect(main.getByText('Coming soon').first()).toBeVisible();
      });

      test('a project changing state elsewhere shows on its card', async ({ page }) => {
        const api = await fakeApi(page, {
          state: { ...canvas, projects: { ...canvas.projects, admin: project('stopped') } },
        });
        await page.goto('/');
        await expect(page.locator('[data-connection]')).toHaveText('Live');
        await api.send(
          envelope(2, {
            event: {
              Time: '',
              Project: 'storefront',
              Server: '',
              State: 'error',
              Message: 'state: error: exited with status 1',
            },
          }),
        );
        const card = page.locator('main').getByRole('article', { name: 'storefront' });
        await expect(card).toContainText('Error');
        await expect(card).toContainText('exited with status 1');
      });
    });
  }
}

test.describe('open projects in the browser', () => {
  test.use({ viewport: sizes[0].viewport });

  test('Preview goes to the browser when the device says so, or the project does', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('nearhost.alwaysBrowser.docs-site', '1'));
    await fakeApi(page, { state: canvas });
    await page.goto('/');
    const main = page.locator('main');
    await expect(main.getByRole('link', { name: 'Preview storefront' })).toHaveAttribute(
      'href',
      '/projects/storefront',
    );
    const docs = main.getByRole('link', { name: 'Preview docs-site' });
    await expect(docs).toHaveAttribute('href', 'https://docs-site.lab.example.dev');
    await expect(docs).toHaveAttribute('target', '_blank');

    await page.evaluate(() => localStorage.setItem('nearhost.openProjectsIn', 'browser'));
    await page.reload();
    await expect(main.getByRole('link', { name: 'Preview storefront' })).toHaveAttribute(
      'href',
      'https://storefront.lab.example.dev',
    );
  });

  test('on a core that does not serve the network, links go to the local address', async ({
    page,
  }) => {
    await fakeApi(page, { state: canvas, session: { networked: false } });
    await page.goto('/');
    await expect(
      page.locator('main').getByRole('link', { name: 'Open storefront in the browser' }),
    ).toHaveAttribute('href', 'https://storefront.test');
  });
});

import { expect, test, type Page } from '@playwright/test';
import { envelope, fakeApi } from './fake-api.js';
import { canvas, project, serveSites } from './fixtures.js';
import { schemes, sizes } from './sizes.js';

function watchForCsp(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

for (const size of sizes) {
  for (const scheme of schemes) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme });
      const phone = size.viewport.width < 600;

      test('Preview opens the frame on the primary route, and a route switches it', async ({
        page,
      }) => {
        const csp = watchForCsp(page);
        await fakeApi(page, { state: canvas });
        await serveSites(page);
        await page.goto('/');
        await page.locator('main').getByRole('link', { name: 'Preview storefront' }).click();
        await expect(page).toHaveURL(/\/projects\/storefront$/);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('storefront');
        const frame = page.locator('iframe[data-preview]');
        await expect(frame).toHaveAttribute('src', 'https://storefront.lab.example.dev');
        await expect(page.frameLocator('iframe[data-preview]').getByRole('heading')).toHaveText(
          'storefront.lab.example.dev',
        );

        if (phone) {
          await page.getByRole('combobox', { name: 'Route' }).selectOption('mail.storefront');
        } else {
          const tabs = page.getByRole('tablist', { name: 'Routes' });
          await expect(tabs.getByRole('tab')).toHaveText([
            'storefront',
            'mail.storefront',
            'vite.storefront',
          ]);
          await tabs.getByRole('tab', { name: 'mail.storefront' }).click();
          await expect(tabs.getByRole('tab', { name: 'mail.storefront' })).toHaveAttribute(
            'aria-selected',
            'true',
          );
        }
        await expect(frame).toHaveAttribute('src', 'https://mail.storefront.lab.example.dev');
        const open = page.getByRole('link', { name: 'Open in browser' });
        await expect(open).toHaveAttribute('href', 'https://mail.storefront.lab.example.dev');
        await expect(open).toHaveAttribute('target', '_blank');

        // The frame fills the area between the bars.
        const box = (await frame.boundingBox())!;
        expect(box.width).toBeGreaterThan(size.viewport.width - 60);
        expect(box.height).toBeGreaterThan(size.viewport.height * 0.5);
        expect(csp).toEqual([]);
      });

      if (!phone) {
        test('the frame takes a tablet or a phone width', async ({ page }) => {
          await fakeApi(page, { state: canvas });
          await serveSites(page);
          await page.goto('/projects/storefront');
          const frame = page.locator('iframe[data-preview]');
          await expect(frame).toBeVisible();
          const widths = page.getByRole('radiogroup', { name: 'Frame width' });
          await widths.getByRole('radio', { name: 'Phone width' }).click();
          await expect(widths.getByRole('radio', { name: 'Phone width' })).toHaveAttribute(
            'aria-checked',
            'true',
          );
          await expect.poll(async () => (await frame.boundingBox())!.width).toBe(390);
          await widths.getByRole('radio', { name: 'Fill' }).click();
          await expect
            .poll(async () => (await frame.boundingBox())!.width)
            .toBeGreaterThan(size.viewport.width - 60);
        });
      }

      if (!phone) {
        test('the keyboard reaches every route with the arrow keys, Home and End', async ({
          page,
        }) => {
          await fakeApi(page, { state: canvas });
          await serveSites(page);
          await page.goto('/projects/storefront');
          const tabs = page.getByRole('tablist', { name: 'Routes' });
          const tab = (name: string) => tabs.getByRole('tab', { name, exact: true });
          const frame = page.locator('iframe[data-preview]');
          await tab('storefront').focus();
          await page.keyboard.press('ArrowRight');
          await expect(tab('mail.storefront')).toBeFocused();
          await expect(tab('mail.storefront')).toHaveAttribute('aria-selected', 'true');
          await expect(frame).toHaveAttribute('src', 'https://mail.storefront.lab.example.dev');
          await page.keyboard.press('End');
          await expect(tab('vite.storefront')).toBeFocused();
          await page.keyboard.press('ArrowRight');
          await expect(tab('storefront')).toBeFocused();
          await page.keyboard.press('ArrowLeft');
          await expect(tab('vite.storefront')).toBeFocused();
          await page.keyboard.press('Home');
          await expect(tab('storefront')).toBeFocused();
          await expect(tab('storefront')).toHaveAttribute('aria-selected', 'true');
          await expect(frame).toHaveAttribute('src', 'https://storefront.lab.example.dev');
        });
      }

      test("a page that never loads shows that it didn't load in the frame", async ({ page }) => {
        await page.clock.install();
        await fakeApi(page, { state: canvas });
        await serveSites(page, { hang: ['storefront.lab.example.dev'] });
        await page.goto('/projects/storefront');
        await expect(page.locator('iframe[data-preview]')).toHaveAttribute(
          'src',
          'https://storefront.lab.example.dev',
        );
        const alert = page.getByRole('alert');
        await page.clock.fastForward(7_000);
        await expect(alert).toHaveCount(0);
        await page.clock.fastForward(1_500);
        await expect(alert.getByRole('heading')).toHaveText("storefront didn't load in the frame");
        await expect(alert.getByRole('link', { name: 'Open in browser' })).toHaveAttribute(
          'href',
          'https://storefront.lab.example.dev',
        );
        await alert.getByRole('button', { name: 'Always open storefront in the browser' }).click();
        expect(
          await page.evaluate(() => localStorage.getItem('nearhost.alwaysBrowser.storefront')),
        ).toBe('1');
        await expect(alert).toContainText('opens storefront in the browser from now on');
      });

      test('a starting project shows its routes and log, then the site', async ({ page }) => {
        const api = await fakeApi(page, {
          state: {
            ...canvas,
            projects: {
              ...canvas.projects,
              storefront: project('starting', { Message: 'waiting for port 80 to answer' }),
            },
          },
        });
        await serveSites(page);
        await page.goto('/projects/storefront');
        await expect(page.locator('[data-connection]')).toHaveText('Live');
        const panel = page.getByRole('status').filter({ hasText: 'Starting storefront' });
        await expect(panel).toContainText(/waiting for port 80 to answer/i);
        const routes = page.getByRole('list', { name: 'Routes' });
        await expect(routes.getByRole('listitem')).toHaveCount(3);
        await expect(routes).toContainText('mail.storefront');
        await expect(routes).toContainText(':8025');
        await expect(page.locator('iframe[data-preview]')).toHaveCount(0);

        const log = (seq: number, Message: string) =>
          envelope(seq, {
            event: { Time: '', Project: 'storefront', Server: '', State: '', Message },
          });
        await api.send(
          log(2, 'Container storefront-redis-1  Started'),
          log(3, 'Waiting for MySQL to accept connections...'),
          envelope(4, {
            event: { Time: '', Project: 'admin', Server: '', State: '', Message: 'not mine' },
          }),
        );
        const pre = page.getByLabel('Log');
        await expect(pre).toContainText('Container storefront-redis-1  Started');
        await expect(pre).toContainText('Waiting for MySQL to accept connections...');
        await expect(pre).not.toContainText('not mine');

        await api.send(
          envelope(5, {
            event: {
              Time: '',
              Project: 'storefront',
              Server: '',
              State: 'running',
              Message: 'state: running',
            },
          }),
        );
        await expect(page.locator('iframe[data-preview]')).toHaveAttribute(
          'src',
          'https://storefront.lab.example.dev',
        );
      });

      test('a project started on a networked core opens at its network address', async ({
        page,
      }) => {
        // The core gives admin's network address only once it runs: the app reads it again then.
        const api = await fakeApi(page, { state: canvas, networkWhileRunning: true });
        api.on('POST /api/v1/projects/admin/start', () => ({ status: 204 }));
        await serveSites(page);
        await page.goto('/');
        await expect(page.locator('[data-connection]')).toHaveText('Live');
        const main = page.locator('main');
        const card = main.getByRole('article', { name: 'admin' });
        await card.getByRole('button', { name: 'Start admin' }).click();
        const change = (seq: number, State: 'starting' | 'running') =>
          envelope(seq, {
            event: { Time: '', Project: 'admin', Server: '', State, Message: `state: ${State}` },
          });
        await api.send(change(2, 'starting'), change(3, 'running'));
        await expect(card).toContainText('Running');
        await expect(card.getByRole('link', { name: 'Open admin in the browser' })).toHaveAttribute(
          'href',
          'https://admin.lab.example.dev',
        );
        await card.getByRole('link', { name: 'Preview admin' }).click();
        await expect(page).toHaveURL(/\/projects\/admin$/);
        await expect(page.locator('iframe[data-preview]')).toHaveAttribute(
          'src',
          'https://admin.lab.example.dev',
        );
        await expect(page.getByRole('link', { name: 'Open in browser' })).toHaveAttribute(
          'href',
          'https://admin.lab.example.dev',
        );
      });

      test("a route the network doesn't have says why, and links nowhere", async ({ page }) => {
        // docs-site runs but has no network address yet; storefront's mail route has none.
        const state = structuredClone(canvas);
        delete state.sites!['docs-site'].routes![0].networkUrl;
        delete state.sites!.storefront.routes![1].networkUrl;
        delete state.sites!.admin.routes![0].networkUrl;
        await fakeApi(page, { state });
        await serveSites(page);
        await page.goto('/');
        const main = page.locator('main');
        const card = main.getByRole('article', { name: 'docs-site' });
        await expect(card).toContainText('Not on the network yet');
        await expect(card.getByRole('link')).toHaveCount(0);
        await expect(
          card.getByRole('button', { name: 'Preview docs-site', includeHidden: true }),
        ).toBeDisabled();
        await expect(
          card.getByRole('button', { name: 'Open docs-site in the browser' }),
        ).toBeDisabled();
        await expect(
          card.getByRole('button', { name: 'Open docs-site in the browser' }),
        ).toHaveAccessibleDescription('Not on the network yet');
        await expect(main.locator('a[href*=".test"]')).toHaveCount(0);

        await page.goto('/projects/storefront');
        await expect(page.locator('iframe[data-preview]')).toBeVisible();
        if (phone) {
          await page.getByRole('combobox', { name: 'Route' }).selectOption('mail.storefront');
        } else {
          await page
            .getByRole('tablist', { name: 'Routes' })
            .getByRole('tab', { name: 'mail.storefront' })
            .click();
        }
        await expect(page.locator('iframe[data-preview]')).toHaveCount(0);
        await expect(page.getByText("storefront isn't on the network yet")).toBeVisible();
        const open = page.getByRole('button', { name: 'Open in browser' });
        await expect(open).toBeDisabled();
        await expect(open).toHaveAccessibleDescription('Not on the network yet');
        await expect(page.getByRole('link', { name: 'Open in browser' })).toHaveCount(0);

        // A stopped project the network doesn't have: start it to open it here.
        await page.goto('/projects/admin');
        await expect(page.getByRole('heading', { name: 'admin is stopped' })).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Open in browser' }),
        ).toHaveAccessibleDescription('Start it to open it here');
        await expect(page.locator('a[href*=".test"]')).toHaveCount(0);
      });

      test('an unknown project says so, with the way back', async ({ page }) => {
        await fakeApi(page, { state: canvas });
        await page.goto('/projects/nope');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('nope');
        await expect(page.locator('main')).toContainText(
          'There is no project called nope on leto.',
        );
        await expect(page.getByRole('link', { name: 'Back to overview' })).toBeVisible();
      });
    });
  }
}

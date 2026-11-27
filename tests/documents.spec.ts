import { expect, outsideTheApp, test, type Page } from './test.js';
import { envelope, fakeApi, type FakeApi } from './fake-api.js';
import { checkoutPlan, scriptedDocument, trees } from './fixtures.js';
import { schemes, sizes } from './sizes.js';

async function withDocuments(page: Page, state = { documents: trees }): Promise<FakeApi> {
  const api = await fakeApi(page, { state });
  api.documents['/d/T1/docs/plans/checkout.md'] = { markdown: checkoutPlan, title: 'checkout.md' };
  api.documents['/d/T1/docs/ideas.md'] = { markdown: '<h1>Ideas</h1>', title: 'ideas.md' };
  api.documents['/d/T2/docs/rate-limits.html'] = { html: scriptedDocument };
  return api;
}

/** Sets a device setting before the app loads. */
async function setting(page: Page, key: string, value: string) {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, value] as const);
}

const reader = (page: Page) => page.locator('iframe[data-document]');
const inFrame = (page: Page) => page.frameLocator('iframe[data-document]');

for (const size of sizes) {
  for (const scheme of schemes) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme });

      test('the list shows each folder’s documents, and one opens in the reader', async ({
        page,
      }) => {
        const api = await withDocuments(page);
        await page.goto('/documents');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Documents');
        // Newest folder first, as the core lists them.
        await expect(main.getByRole('heading', { level: 2 })).toHaveText(['api', 'storefront']);
        await expect(main.getByText('build-box · Codex')).toBeVisible();
        await expect(main.getByText('leto · Claude Code')).toBeVisible();
        const links = main.getByRole('link', { name: /\.(md|html)/ });
        await expect(links).toHaveCount(3);
        await expect(links.nth(0)).toHaveAttribute('href', '/documents/T2/docs/rate-limits.html');

        await main.getByRole('link', { name: /checkout\.md/ }).click();
        await expect(page).toHaveURL(/\/documents\/T1\/docs\/plans\/checkout\.md$/);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('checkout.md');
        await expect(
          main.getByText('leto · /Users/ecs/Code/storefront/docs/plans/checkout.md'),
        ).toBeVisible();
        const frame = reader(page);
        await expect(frame).toHaveAttribute('src', '/d/T1/docs/plans/checkout.md?theme=paper');
        // Scripts off and an opaque origin: neither allow-scripts nor allow-same-origin.
        await expect(frame).toHaveAttribute('sandbox', 'allow-popups');
        await expect(inFrame(page).getByRole('heading', { level: 1 })).toHaveText(
          'Checkout redesign',
        );
        // Paper is a light page in either scheme.
        await expect(inFrame(page).locator('html')).toHaveAttribute('data-nh-theme', 'paper');
        await expect(inFrame(page).locator('body')).toHaveCSS(
          'background-color',
          'rgb(244, 245, 241)',
        );
        expect(api.documentRequests).toContain('/d/T1/docs/plans/checkout.md?theme=paper');

        const open = main.getByRole('link', { name: 'Open in browser' });
        await expect(open).toHaveAttribute('href', '/d/T1/docs/plans/checkout.md?theme=paper');
        await expect(open).toHaveAttribute('target', '_blank');

        // The frame fills the area below the reader's bar.
        const box = (await frame.boundingBox())!;
        expect(box.width).toBeGreaterThan(size.viewport.width - 2);
        expect(box.y + box.height).toBeGreaterThan(size.viewport.height - size.bottom - 2);
        expect(box.height).toBeGreaterThan(size.viewport.height * 0.6);
        await expect(page.locator('[data-followed-link]')).toHaveCount(0);

        await main.getByRole('link', { name: 'Back to documents' }).click();
        await expect(page).toHaveURL(/\/documents$/);
      });

      test('the theme switch changes the frame and is kept on this device', async ({ page }) => {
        await withDocuments(page);
        await page.goto('/documents/T1/docs/plans/checkout.md');
        const frame = reader(page);
        await expect(frame).toHaveAttribute('src', '/d/T1/docs/plans/checkout.md?theme=paper');

        const style = page.getByRole('button', { name: 'Document style' });
        await style.click();
        const themes = page.getByRole('radiogroup', { name: 'Document style' });
        await expect(themes.getByRole('radio')).toHaveText(['Paper', 'Match app', 'As written']);
        await expect(themes.getByRole('radio', { name: 'Paper' })).toBeChecked();

        // One tab stop, the checked option; the arrow keys pick and focus the next, wrapping.
        const paper = themes.getByRole('radio', { name: 'Paper' });
        const match = themes.getByRole('radio', { name: 'Match app' });
        const written = themes.getByRole('radio', { name: 'As written' });
        await expect(paper).toHaveAttribute('tabindex', '0');
        await expect(match).toHaveAttribute('tabindex', '-1');
        await expect(written).toHaveAttribute('tabindex', '-1');
        await paper.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(written).toBeChecked();
        await expect(written).toBeFocused();
        await expect(written).toHaveAttribute('tabindex', '0');
        await expect(frame).toHaveAttribute('src', '/d/T1/docs/plans/checkout.md');
        await page.keyboard.press('ArrowDown');
        await expect(paper).toBeChecked();
        await page.keyboard.press('ArrowRight');
        await expect(match).toBeChecked();
        await expect(match).toBeFocused();
        await themes.getByRole('radio', { name: 'Match app' }).check();
        await expect(frame).toHaveAttribute(
          'src',
          `/d/T1/docs/plans/checkout.md?theme=app&scheme=${scheme}`,
        );
        await expect(inFrame(page).locator('html')).toHaveAttribute('data-nh-scheme', scheme);
        await expect(inFrame(page).locator('body')).toHaveCSS(
          'background-color',
          scheme === 'dark' ? 'rgb(17, 16, 19)' : 'rgb(246, 244, 246)',
        );
        expect(await page.evaluate(() => localStorage.getItem('nearhost.documentsTheme'))).toBe(
          'app',
        );

        await page.reload();
        await expect(frame).toHaveAttribute(
          'src',
          `/d/T1/docs/plans/checkout.md?theme=app&scheme=${scheme}`,
        );

        await page.getByRole('button', { name: 'Document style' }).click();
        await page
          .getByRole('radiogroup', { name: 'Document style' })
          .getByRole('radio', { name: 'As written' })
          .check();
        await expect(frame).toHaveAttribute('src', '/d/T1/docs/plans/checkout.md');
        await expect(inFrame(page).locator('html')).not.toHaveAttribute('data-nh-theme', /./);
        expect(await page.evaluate(() => localStorage.getItem('nearhost.documentsTheme'))).toBe(
          'written',
        );
        // Escape closes the switch.
        await page.keyboard.press('Escape');
        await expect(page.getByRole('radiogroup', { name: 'Document style' })).toBeHidden();
      });

      test('no documents: the canvas’s empty state', async ({ page }) => {
        await fakeApi(page);
        await page.goto('/documents');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Documents');
        await expect(main.getByRole('heading', { level: 2 })).toHaveText('No documents yet');
        await expect(
          main.getByText(
            'When an agent using the Nearhost skill writes a plan, spec or report for you, it shows up here to read.',
          ),
        ).toBeVisible();
      });

      test('a script in a document never runs', async ({ page }) => {
        await setting(page, 'nearhost.documentsTheme', 'written');
        const messages: string[] = [];
        await page.exposeFunction('__sawMessage', (m: string) => messages.push(m));
        await page.addInitScript(() =>
          window.addEventListener('message', (e) =>
            (window as unknown as { __sawMessage(m: string): void }).__sawMessage(String(e.data)),
          ),
        );
        await withDocuments(page);
        await page.goto('/documents/T2/docs/rate-limits.html');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('rate-limits.html');
        await expect(reader(page)).toHaveAttribute('src', '/d/T2/docs/rate-limits.html');
        await expect(inFrame(page).getByRole('heading', { level: 1 })).toHaveText(
          'Rate limiting for the API',
        );
        await page.waitForTimeout(300);
        await expect(inFrame(page).locator('body')).not.toHaveAttribute('data-script-ran');
        expect(await page.title()).toBe('Nearhost');
        expect(messages).toEqual([]);
      });
    });
  }
}

test.describe('the reader', () => {
  test.use({ viewport: sizes[0].viewport });

  test('the fixture’s script runs where scripts are allowed, so the test above means something', async ({
    page,
  }) => {
    outsideTheApp('the document itself, which the worker never serves');
    await withDocuments(page);
    await page.goto('/d/T2/docs/rate-limits.html');
    await expect(page.locator('body')).toHaveAttribute('data-script-ran', '');
  });

  test('Match app follows the app’s appearance, not only the system’s', async ({ page }) => {
    await setting(page, 'nearhost.documentsTheme', 'app');
    await setting(page, 'nearhost.appearance', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    const api = await withDocuments(page);
    await page.goto('/documents/T1/docs/plans/checkout.md');
    await expect(reader(page)).toHaveAttribute(
      'src',
      '/d/T1/docs/plans/checkout.md?theme=app&scheme=light',
    );
    // Asked once, in the right scheme from the start.
    await expect(inFrame(page).locator('h1')).toHaveText('Checkout redesign');
    expect(api.documentRequests).toEqual(['/d/T1/docs/plans/checkout.md?theme=app&scheme=light']);
  });

  test('Match app follows the system when it changes', async ({ page }) => {
    await setting(page, 'nearhost.documentsTheme', 'app');
    await page.emulateMedia({ colorScheme: 'dark' });
    await withDocuments(page);
    await page.goto('/documents/T1/docs/plans/checkout.md');
    await expect(reader(page)).toHaveAttribute('src', /scheme=dark$/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(reader(page)).toHaveAttribute('src', /scheme=light$/);
  });

  test('a link followed inside the document can be undone', async ({ page }) => {
    await setting(page, 'nearhost.documentsTheme', 'written');
    const api = await withDocuments(page);
    await page.goto('/documents/T2/docs/rate-limits.html');
    await inFrame(page).getByRole('link', { name: 'The ideas' }).click();
    await expect(inFrame(page).getByRole('heading', { level: 1 })).toHaveText('Ideas');
    const bar = page.locator('[data-followed-link]');
    await expect(bar).toContainText('You followed a link in this document.');
    await bar.getByRole('button', { name: 'Back to the document' }).click();
    await expect(inFrame(page).getByRole('heading', { level: 1 })).toHaveText(
      'Rate limiting for the API',
    );
    await expect(bar).toHaveCount(0);
    expect(api.documentRequests.filter((r) => r === '/d/T2/docs/rate-limits.html')).toHaveLength(2);
  });

  test('a document that isn’t served any more says so', async ({ page }) => {
    await withDocuments(page);
    await page.goto('/documents/T9/plans/gone.md');
    const main = page.locator('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('gone.md');
    await expect(main.getByText('This document isn’t served any more.')).toBeVisible();
    await expect(reader(page)).toHaveCount(0);
    await main.getByRole('link', { name: 'Go to documents' }).click();
    await expect(page).toHaveURL(/\/documents$/);
  });

  test('a new document shown by an agent joins the list', async ({ page }) => {
    const api = await withDocuments(page);
    await page.goto('/documents');
    await expect(page.locator('main').getByRole('link', { name: /\.(md|html)/ })).toHaveCount(3);
    api.state.documents = [
      {
        ...trees[1],
        Docs: [{ Path: 'docs/report.md', Opened: '2026-11-27T12:00:00Z' }, ...trees[1].Docs!],
      },
      trees[0],
    ];
    await api.send(
      envelope(2, {
        kind: 'shown',
        shown: { origin: 'local', requester: 'claude-code', doc: 'docs/report.md' },
      }),
    );
    await expect(page.locator('main').getByRole('link', { name: /\.(md|html)/ })).toHaveCount(4);
    await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveText([
      'storefront',
      'api',
    ]);
  });
});

import { expect, test } from '@playwright/test';
import { fakeApi } from './fake-api.js';
import { schemes, sizes } from './sizes.js';

// Every route of the app, including the links the core, the skill and the agents hand out, renders
// inside the shell with its own <h1>; an unknown path shows the not-found view there too.
const routes = [
  { path: '/', heading: 'Overview' },
  { path: '/projects/shop', heading: 'shop' },
  { path: '/approve/a1', heading: 'Waiting for you' },
  { path: '/change/shop', heading: 'Change to shop' },
  { path: '/documents', heading: 'Documents' },
  { path: '/documents/storefront/plans/checkout.md', heading: 'checkout.md' },
  { path: '/machine', heading: 'This machine' },
  { path: '/no/such/page', heading: 'Page not found' },
] as const;

for (const size of sizes) {
  for (const scheme of schemes) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme });

      test('each route renders inside the shell with its own heading', async ({ page }) => {
        await fakeApi(page);
        for (const route of routes) {
          await page.goto(route.path);
          const main = page.locator('[data-shell] main');
          await expect(main.getByRole('heading', { level: 1 })).toHaveText(route.heading);
          // One <h1> on the page, and the header holds no heading at all.
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
          await expect(page.locator('header').getByRole('heading')).toHaveCount(0);
          await expect(
            page.locator('header').getByRole('link', { name: 'Nearhost' }),
          ).toBeVisible();
        }
      });
    });
  }
}

test.describe('links from outside the app', () => {
  test.use({ viewport: sizes[0].viewport });

  test('a project name with spaces and slashes is the heading, decoded', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/change/my%20shop');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Change to my shop');
  });

  test('the not-found view links back to the overview', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/nowhere');
    await page.locator('main').getByRole('link', { name: 'Go to the overview' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');
  });
});

test.describe('the fake API', () => {
  test.use({ viewport: sizes[0].viewport });

  test('the app is live against it, and stays live on heartbeats', async ({ page }) => {
    const api = await fakeApi(page);
    await page.goto('/');
    await expect(page.locator('[data-connection]')).toHaveText('Live');
    await expect(page.locator('[data-machine]')).toHaveText('leto');
    await api.heartbeat();
    await expect(page.locator('[data-connection]')).toHaveText('Live');
    expect(api.requests.map((r) => `${r.method} ${r.path}`)).toContain('GET /api/v1/state');
  });

  test('a dropped stream says the machine cannot be reached', async ({ page }) => {
    const api = await fakeApi(page);
    await page.goto('/');
    await expect(page.locator('[data-connection]')).toHaveText('Live');
    api.on('GET /api/v1/state', () => ({
      status: 502,
      body: { title: 'Bad gateway', status: 502 },
    }));
    await api.drop();
    await expect(page.locator('[data-connection]')).toHaveText("Can't reach leto");
  });

  test('not paired says so', async ({ page }) => {
    await fakeApi(page, { signedOut: true });
    await page.goto('/');
    await expect(page.locator('[data-connection]')).toHaveText('Not paired');
  });
});

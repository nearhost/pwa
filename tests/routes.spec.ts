import { expect, test } from '@playwright/test';
import { envelope, fakeApi } from './fake-api.js';
import { schemes, sizes } from './sizes.js';

// Every route of the app, including the links the core, the skill and the agents hand out, renders
// inside the shell with its own <h1>; an unknown path shows the not-found view there too.
const routes = [
  { path: '/', heading: 'Overview' },
  { path: '/projects/shop', heading: 'shop' },
  { path: '/approve/a1', heading: 'This request is no longer waiting' },
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

  test('a project name with a space or a slash is the heading, decoded', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/change/my%20shop');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Change to my shop');
    await page.goto('/change/a%2Fb');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Change to a/b');
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

  test('a config envelope reads the state once more, and the app stays live', async ({ page }) => {
    const api = await fakeApi(page);
    await page.goto('/');
    await expect(page.locator('[data-connection]')).toHaveText('Live');
    const reads = () => api.requests.filter((r) => r.path === '/api/v1/state').length;
    expect(reads()).toBe(1);
    await api.send(envelope(6, { kind: 'config' }), envelope(7, { kind: 'shown' }));
    await expect.poll(reads).toBe(2);
    // Settled: no further reads, as there would be if the fake's seq stood still.
    await page.waitForTimeout(300);
    expect(reads()).toBe(2);
    await expect(page.locator('[data-connection]')).toHaveText('Live');
  });

  test('a write without the token or the JSON type is refused, as by the core', async ({
    page,
  }) => {
    const api = await fakeApi(page);
    api.on('POST /api/v1/projects/shop/start', () => ({ status: 204 }));
    await page.goto('/');
    const statuses = await page.evaluate(async () => {
      const post = (headers: Record<string, string>) =>
        fetch('/api/v1/projects/shop/start', { method: 'POST', headers }).then((r) => r.status);
      return [
        await post({}),
        await post({ 'Content-Type': 'application/json' }),
        await post({ 'X-Nearhost-CSRF': 'token-1' }),
        await post({ 'X-Nearhost-CSRF': 'token-1', 'Content-Type': 'application/json' }),
      ];
    });
    expect(statuses).toEqual([403, 403, 403, 204]);
    const missing = await page.evaluate(() =>
      fetch('/api/v1/nowhere').then((r) => r.json() as Promise<{ code: string }>),
    );
    expect(missing.code).toBe('control.not-found');
  });

  test('not paired says so', async ({ page }) => {
    await fakeApi(page, { signedOut: true });
    await page.goto('/');
    await expect(page.locator('[data-connection]')).toHaveText('Not paired');
  });
});

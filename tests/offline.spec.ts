import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { fakeApi, type FakeApi } from './fake-api.js';
import { canvas, project } from './fixtures.js';
import { schemes, sizes } from './sizes.js';

// Offline: the service worker keeps the app's shell, so a reload without a network shows the app
// and says it can't reach the machine, never a browser's error page; it never keeps the API's
// answers. And the offline view itself: shown at once when the core hasn't answered since the app
// loaded, after 10 s of a lost connection otherwise, gone once it is live, with Try again.

/**
 * Makes the core unreachable for the API, as a network that is gone does: every /api request
 * fails, whatever the fake would answer. Routes added later win, so this goes after fakeApi.
 */
async function unreachable(page: Page) {
  const gate = { down: false, refused: [] as string[] };
  await page.route('**/api/**', (route) => {
    if (!gate.down) return route.fallback();
    gate.refused.push(new URL(route.request().url()).pathname);
    return route.abort('internetdisconnected');
  });
  return gate;
}

// The service worker that controls the page, once it is activated.
async function workerReady(page: Page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active!;
    if (worker.state !== 'activated') {
      await new Promise<void>((resolve) =>
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve();
        }),
      );
    }
  });
}

async function setOffline(context: BrowserContext, gate: { down: boolean }, offline: boolean) {
  gate.down = offline;
  await context.setOffline(offline);
}

const offlineView = (page: Page) => page.locator('[data-offline]');

test.describe('the service worker', () => {
  // playwright.config.ts blocks the worker everywhere else.
  test.use({ viewport: sizes[0].viewport, colorScheme: 'dark', serviceWorkers: 'allow' });

  test('is the build’s service-worker.js, registered for the whole app', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/');
    await workerReady(page);
    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { scope: r.scope, script: r.active!.scriptURL };
    });
    expect(new URL(registration.scope).pathname).toBe('/');
    expect(new URL(registration.script).pathname).toBe('/service-worker.js');
  });

  test('after one visit, a reload offline shows the shell and the offline view', async ({
    page,
    context,
  }) => {
    await fakeApi(page, { state: canvas });
    const gate = await unreachable(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'storefront' })).toBeVisible();
    await workerReady(page);

    await setOffline(context, gate, true);
    await page.reload();
    // The app's own shell, from the cache: the header, the machine it last answered as and why.
    await expect(page.locator('header')).toBeVisible();
    await expect(offlineView(page)).toBeVisible();
    await expect(offlineView(page).getByRole('heading', { level: 1 })).toHaveText(
      "Can't reach leto",
    );
    await expect(offlineView(page)).toContainText(/Last answered at \d{1,2}:\d{2}/);
    await expect(offlineView(page).getByRole('listitem')).toHaveCount(3);
    await expect(page.locator('[data-connection]')).toHaveText("Can't reach leto");
    // Nothing from before is shown as if it were live.
    await expect(page.getByRole('heading', { name: 'storefront' })).toHaveCount(0);

    // A route of the app loads from the shell too.
    await page.goto('/projects/storefront');
    await expect(offlineView(page)).toBeVisible();
  });

  test('clears the old page’s shell cache and older builds’ caches once it activates', async ({
    page,
  }) => {
    // What a device that had the old page (its /sw.js) or an older build keeps, made before the
    // worker installs: installing fetches the whole build, so these are there first.
    await page.addInitScript(() => {
      void caches
        .open('nearhost-shell-0.16.0')
        .then((c) => c.put('/offline.html', new Response('old')));
      void caches.open('nearhost-app-1').then((c) => c.put('/index.html', new Response('old')));
      void caches.open('not-ours').then((c) => c.put('/x', new Response('x')));
    });
    await fakeApi(page, { state: canvas });
    await page.goto('/');
    await workerReady(page);
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .toEqual(expect.arrayContaining(['not-ours']));
    const names = await page.evaluate(() => caches.keys());
    expect(names.filter((n) => n.startsWith('nearhost-'))).toHaveLength(1);
    expect(names.find((n) => n.startsWith('nearhost-'))).toMatch(/^nearhost-app-\d+$/);
    expect(names).not.toContain('nearhost-app-1');
  });

  test('takes over at once from the old page’s worker, its /sw.js', async ({
    page,
    context,
    browserName,
  }) => {
    // The old page's worker is served by a route mock, which only Chromium applies to a worker's
    // own script.
    test.skip(browserName !== 'chromium', 'only Chromium routes a service worker’s script');
    await context.route('**/sw.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: [
          "self.addEventListener('install', () => self.skipWaiting());",
          "self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));",
          "self.addEventListener('fetch', () => {});",
        ].join('\n'),
      }),
    );
    await fakeApi(page, { state: canvas });
    // A device that had the old page: its worker is in charge of the whole origin, before the app
    // ever loads.
    await page.goto('/manifest.webmanifest');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const worker = (await navigator.serviceWorker.ready).active!;
      if (worker.state === 'activated') return;
      await new Promise<void>((resolve) =>
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve();
        }),
      );
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'storefront' })).toBeVisible();
    const scripts = () =>
      page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration('/');
        return {
          active: r?.active && new URL(r.active.scriptURL).pathname,
          waiting: r?.waiting && new URL(r.waiting.scriptURL).pathname,
          controller:
            navigator.serviceWorker.controller &&
            new URL(navigator.serviceWorker.controller.scriptURL).pathname,
        };
      });
    // The open page, which the old worker controlled, is the app's worker's now, nothing waiting.
    await expect
      .poll(scripts, { timeout: 15_000 })
      .toEqual({ active: '/service-worker.js', waiting: null, controller: '/service-worker.js' });
  });

  test('keeps the shell and the build’s files, nothing of the core’s', async ({ page }) => {
    await fakeApi(page, { state: canvas });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'storefront' })).toBeVisible();
    await workerReady(page);
    const kept = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
      }
      return urls;
    });
    expect(kept).toContain('/index.html');
    expect(kept).toContain('/manifest.webmanifest');
    expect(kept.some((p) => p.startsWith('/_app/immutable/'))).toBe(true);
    expect(
      kept.filter((p) => /^\/(api|d|pair|auth|\.well-known|\.nearhost)(\/|$)/.test(p)),
    ).toEqual([]);
  });

  // The next two follow the fake core through a page the worker controls. Playwright's WebKit
  // doesn't route such a page's requests to the route mocks, though the worker leaves them to the
  // network (it sends them to the preview server instead), so they run in Chromium only.
  const routedUnderWorker = 'Playwright WebKit does not route requests of a worker-controlled page';

  test('never serves the API from its cache, and is live again once back', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', routedUnderWorker);
    const api = await fakeApi(page, { state: { projects: { shop: project('running') } } });
    const gate = await unreachable(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'shop' })).toBeVisible();
    await workerReady(page);

    // The core's state changes between visits: the next visit shows the new one.
    api.state.projects = { cart: project('running') };
    await page.reload();
    await expect(page.getByRole('heading', { name: 'cart' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'shop' })).toHaveCount(0);

    // Offline, no state at all: not the last one from a cache.
    await setOffline(context, gate, true);
    await page.reload();
    await expect(offlineView(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'cart' })).toHaveCount(0);

    // And back online, the state the core has now.
    api.state.projects = { till: project('running') };
    await setOffline(context, gate, false);
    await expect(page.getByRole('heading', { name: 'till' })).toBeVisible();
    await expect(offlineView(page)).toHaveCount(0);
    await expect(page.locator('[data-connection]')).toHaveText('Live');
  });

  test('leaves the API to the network, where the fake answers it', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', routedUnderWorker);
    const api = await fakeApi(page, { state: canvas });
    await page.goto('/');
    await workerReady(page);
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    // Under the worker, the page's own requests still reach the fake core.
    const before = api.requests.filter((r) => r.path === '/api/v1/state').length;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'storefront' })).toBeVisible();
    expect(api.requests.filter((r) => r.path === '/api/v1/state').length).toBeGreaterThan(before);
  });
});

test.describe('the offline view', () => {
  test.use({ viewport: sizes[0].viewport, colorScheme: 'dark' });

  test('shows at once when the core has not answered since the app loaded', async ({ page }) => {
    await fakeApi(page, { state: canvas });
    const gate = await unreachable(page);
    gate.down = true;
    await page.goto('/');
    await expect(offlineView(page)).toBeVisible();
    // Never answered and never seen before: the machine is "this machine", and no time is made up.
    await expect(offlineView(page).getByRole('heading', { level: 1 })).toHaveText(
      "Can't reach this machine",
    );
    await expect(offlineView(page)).not.toContainText('Last answered');
    await expect(offlineView(page)).toContainText('nearhost status');
  });

  test('replaces a screen only after 10 s of a lost connection', async ({ page }) => {
    await page.clock.install();
    const api = await fakeApi(page, { state: canvas });
    const gate = await unreachable(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'storefront' })).toBeVisible();
    gate.down = true;
    await api.drop();
    await expect(page.locator('[data-connection]')).toHaveText("Can't reach leto");
    // At first the screen stays, saying how old it is.
    await expect(page.locator('[data-connection-notice]')).toBeVisible();
    await expect(offlineView(page)).toHaveCount(0);
    await page.clock.fastForward(9_000);
    await expect(offlineView(page)).toHaveCount(0);
    await page.clock.fastForward(1_500);
    await expect(offlineView(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'storefront' })).toHaveCount(0);
    await expect(offlineView(page)).toContainText(/Last answered at \d{1,2}:\d{2}/);
    // The sidebar stays, dimmed, its dot red.
    const sidebar = page.getByRole('navigation', { name: 'Nearhost' });
    await expect(sidebar.locator('[data-dimmed]')).toBeVisible();
    await expect(sidebar.locator('.dot[data-link="lost"]')).toBeVisible();
  });

  test('Try again reconnects, without waiting for the next try', async ({ page }) => {
    await page.clock.install();
    const api: FakeApi = await fakeApi(page, { state: canvas, open: false });
    const gate = await unreachable(page);
    gate.down = true;
    await page.goto('/');
    await expect(offlineView(page)).toBeVisible();
    // Time stops, a minute on: no try of the app's own comes now, so only the button can.
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 60_000);
    // The jump fires the try that was due (the first, after 1 s) once, and the next waits for time
    // that no longer passes.
    const reads = () => gate.refused.filter((p) => p === '/api/v1/state').length;
    await expect.poll(reads).toBe(2);

    const tryAgain = offlineView(page).getByRole('button', { name: 'Try again' });
    // Still unreachable: it tries, says so, and comes back to Try again.
    const before = reads();
    await tryAgain.click();
    await expect.poll(reads).toBe(before + 1);
    await expect(tryAgain).toBeEnabled();
    await expect(offlineView(page)).toBeVisible();

    gate.down = false;
    await tryAgain.click();
    await api.open();
    await expect(offlineView(page)).toHaveCount(0);
    await expect(page.locator('[data-connection]')).toHaveText('Live');
    await expect(page.getByRole('heading', { name: 'storefront' })).toBeVisible();
  });

  for (const size of sizes) {
    for (const scheme of schemes) {
      test.describe(`${size.name}, ${scheme}`, () => {
        test.use({ viewport: size.viewport, colorScheme: scheme });

        test('the view fits, and its Try again is reachable', async ({ page }) => {
          await page.addInitScript(() =>
            localStorage.setItem(
              'nearhost.lastAnswered',
              JSON.stringify({ machine: 'leto', at: new Date().toISOString() }),
            ),
          );
          await fakeApi(page, { state: canvas });
          const gate = await unreachable(page);
          gate.down = true;
          await page.goto('/');
          const view = offlineView(page);
          await expect(view.getByRole('heading', { level: 1 })).toHaveText("Can't reach leto");
          await expect(view).toContainText(/Last answered at \d{1,2}:\d{2}/);
          // The canvas's checks, the machine's name as it is written.
          await expect(view.getByRole('listitem')).toHaveText([
            /^1\s*This device is on the same network as leto, or Tailscale is connected\.$/,
            /^2\s*leto is switched on and awake\.$/,
            /^3\s*The core is running: nearhost status on leto says so\.$/,
          ]);
          const button = view.getByRole('button', { name: 'Try again' });
          await expect(button).toBeInViewport();
          const box = (await button.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          // Nothing runs off the side.
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow).toBe(0);
        });
      });
    }
  }
});

test.describe('when the core last answered', () => {
  test.use({ viewport: sizes[0].viewport });

  test('a heartbeat counts as an answer, kept at most once a minute', async ({ page }) => {
    await page.clock.install();
    const api = await fakeApi(page, { state: canvas });
    await page.goto('/');
    await expect(page.locator('[data-connection]')).toHaveText('Live');
    const kept = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('nearhost.lastAnswered');
        return raw ? Date.parse((JSON.parse(raw) as { at: string }).at) : 0;
      });
    await expect.poll(kept).toBeGreaterThan(0);
    const first = await kept();
    // Two minutes in which the core sends only its heartbeat, every 15 s.
    for (let i = 0; i < 8; i++) {
      await page.clock.fastForward(15_000);
      await api.heartbeat();
    }
    // Kept once in each new minute: two minutes on, at least one of them.
    await expect.poll(kept).toBeGreaterThanOrEqual(first + 60_000);
    await expect(page.locator('[data-connection]')).toHaveText('Live');
  });
});

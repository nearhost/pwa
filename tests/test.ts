// Playwright's test, with the app's service worker in charge under the chromium-sw project: before
// each test the context loads the app once and waits for the worker to activate, so every page the
// test opens on the app's origin is controlled by it, and after the test it checks that the page
// was. The journeys that write, frame documents and follow links from outside then run through the
// worker as they do on a device. Other projects block the worker (see playwright.config.ts).
import { test as base, expect } from '@playwright/test';

export { expect };
export type { Page } from '@playwright/test';

const outsideType = 'outside the app';

/**
 * Says the test ends outside the app's pages (a document of the core's, another origin), so under
 * chromium-sw no page is left to check for the worker.
 */
export function outsideTheApp(why: string) {
  base.info().annotations.push({ type: outsideType, description: why });
}

export const test = base.extend<{ underWorker: void }>({
  underWorker: [
    async ({ context, baseURL }, use, testInfo) => {
      const on = testInfo.project.name === 'chromium-sw';
      if (on) {
        const warm = await context.newPage();
        await warm.goto('/');
        await warm.evaluate(async () => {
          const worker = (await navigator.serviceWorker.ready).active!;
          if (worker.state === 'activated') return;
          await new Promise<void>((resolve) =>
            worker.addEventListener('statechange', () => {
              if (worker.state === 'activated') resolve();
            }),
          );
        });
        await warm.close();
      }
      await use();
      if (!on || testInfo.status !== testInfo.expectedStatus) return;
      // Every page still open on the app's origin, other than the core's documents (a sandboxed
      // page can't have a worker), was the worker's, and there was one, unless the test said it
      // ends outside the app (see outsideTheApp): the run proved something.
      let checked = 0;
      for (const page of context.pages()) {
        if (page.isClosed() || !baseURL || !page.url().startsWith(baseURL)) continue;
        if (new URL(page.url()).pathname.startsWith('/d/')) continue;
        const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
        expect(controlled, `${page.url()} is controlled by the service worker`).toBe(true);
        checked++;
      }
      const outside = testInfo.annotations.some((a) => a.type === outsideType);
      if (!outside) expect(checked, 'a page of the app was open at the end').toBeGreaterThan(0);
    },
    { auto: true },
  ],
});

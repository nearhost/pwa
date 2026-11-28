import { expect, test, type Page } from '@playwright/test';
import { fakeApi } from './fake-api.js';
import { schemes, sizes } from './sizes.js';

// The shell's keep-clear band and the page ground, at the iPad and phone sizes in both colour
// schemes. Desktop browsers report every safe-area inset as 0, which is the case the floors are
// for: an installed app whose status bar inset reads 0.

const grounds = { dark: 'rgb(17, 16, 19)', light: 'rgb(246, 244, 246)' } as const;
const surfaces = { dark: 'rgb(25, 23, 28)', light: 'rgb(255, 255, 255)' } as const;

const interactive = 'a, button, input, select, [tabindex]';

// Playwright cannot emulate display-mode, so standalone is emulated where the app reads it: the
// shell asks matchMedia('(display-mode: standalone)'), and this makes that query match.
async function emulateStandalone(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (!/display-mode:\s*standalone/.test(query)) return real(query);
      const list = real('all');
      return Object.defineProperties(list, {
        matches: { value: true },
        media: { value: query },
      });
    };
  });
}

async function bandHeight(page: Page) {
  const box = await page.locator('[data-shell-band]').boundingBox();
  return box?.height ?? 0;
}

async function expectNothingInteractiveInBand(page: Page, band: number) {
  const tops = await page.locator(interactive).evaluateAll((elements) =>
    elements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => rect.top),
  );
  for (const top of tops) expect(top).toBeGreaterThanOrEqual(band);
}

for (const size of sizes) {
  for (const scheme of schemes) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme });

      test('in a browser tab the band is the inset and nothing tappable sits in it', async ({
        page,
      }) => {
        await page.goto('/');
        const header = page.locator('header');
        await expect(header).toBeVisible();
        const band = await bandHeight(page);
        expect(band).toBe(0);
        expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual(band);
        await expectNothingInteractiveInBand(page, band);
      });

      test('the page background is the ground for the scheme', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('header')).toBeVisible();
        const colours = await page.evaluate(() => ({
          token: getComputedStyle(document.documentElement).getPropertyValue('--nh-ground').trim(),
          html: getComputedStyle(document.documentElement).backgroundColor,
          body: getComputedStyle(document.body).backgroundColor,
        }));
        expect(colours.html).toBe(grounds[scheme]);
        expect(colours.body).toBe(grounds[scheme]);
        expect(colours.token.toLowerCase()).toBe(scheme === 'dark' ? '#111013' : '#f6f4f6');
      });

      test('installed, the band takes its floor and the header sits below it', async ({ page }) => {
        await emulateStandalone(page);
        await page.goto('/');
        const header = page.locator('header');
        await expect(header).toBeVisible();
        const band = await bandHeight(page);
        expect(band).toBe(size.band);
        expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual(band);
        await expectNothingInteractiveInBand(page, band);

        // The header's background runs up under the band.
        const bandColour = await page
          .locator('[data-shell-band]')
          .evaluate((element) => getComputedStyle(element).backgroundColor);
        expect(bandColour).toBe(surfaces[scheme]);

        // The bottom inset keeps content clear of the home indicator.
        const bottom = await page
          .locator('[data-shell]')
          .evaluate((element) => getComputedStyle(element).paddingBottom);
        expect(bottom).toBe(`${size.bottom}px`);
      });

      test("the header's content is 64px high", async ({ page }) => {
        await fakeApi(page);
        await page.goto('/');
        const header = page.locator('header');
        await expect(header).toBeVisible();
        expect(await header.evaluate((element) => element.clientHeight)).toBe(64);
      });

      test('installed and scrolled, nothing tappable shows in the band and the header stays below it', async ({
        page,
      }) => {
        await emulateStandalone(page);
        await fakeApi(page);
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // A long page of buttons, as an overview with many projects is.
        await page.locator('main').evaluate((main) => {
          for (let i = 0; i < 60; i++) {
            const button = document.createElement('button');
            button.textContent = `Project ${i}`;
            button.style.cssText = 'display:block;width:100%;height:48px;margin:8px 0';
            main.append(button);
          }
        });
        // Over the page, not the band at the pointer's starting point.
        await page.mouse.move(size.viewport.width / 2, size.viewport.height / 2);
        await page.mouse.wheel(0, 900);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

        const header = page.locator('header');
        expect((await header.boundingBox())!.y).toBe(size.band);
        expect(await bandHeight(page)).toBe(size.band);

        // What a tap in the band would land on: never anything interactive.
        const hits = await page.evaluate(
          ({ band, selector }) => {
            const found: string[] = [];
            for (let y = 0.5; y < band; y += 4) {
              for (let x = 1; x < window.innerWidth; x += 16) {
                const hit = document.elementFromPoint(x, y);
                const control = hit?.closest(selector);
                if (control) found.push(`${control.tagName} at ${x},${y}`);
              }
            }
            return found;
          },
          { band: size.band, selector: interactive },
        );
        expect(hits).toEqual([]);

        // And below the band, the header, not the scrolled page, takes the taps.
        const underHeader = await page.evaluate((y) => {
          const hit = document.elementFromPoint(window.innerWidth - 2, y + 2);
          return !!hit?.closest('header');
        }, size.band);
        expect(underHeader).toBe(true);
      });
    });
  }
}

test.describe('the page head', () => {
  test('the status bar is black-translucent, so the band runs under it', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
    ).toHaveAttribute('content', 'black-translucent');
  });

  test('the page has a favicon, and it is served', async ({ page, request }) => {
    await page.goto('/');
    const icon = page.locator('link[rel="icon"]');
    // SvelteKit may write the address relative or absolute; either way it is the 192px icon.
    expect(await icon.evaluate((link: HTMLLinkElement) => new URL(link.href).pathname)).toBe(
      '/icons/icon-192.png',
    );
    const answer = await request.get('/icons/icon-192.png');
    expect(answer.status()).toBe(200);
    expect(answer.headers()['content-type']).toBe('image/png');
  });
});

test.describe('appearance setting', () => {
  test.use({ viewport: { width: 1194, height: 834 }, colorScheme: 'dark' });

  test('a stored light appearance overrides a dark system scheme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('nearhost.appearance', 'light'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe(grounds.light);
  });
});

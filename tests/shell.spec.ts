import { expect, test, type Page } from '@playwright/test';

// The shell's keep-clear band and the page ground, at the iPad and phone sizes in both colour
// schemes. Desktop browsers report every safe-area inset as 0, which is the case the floors are
// for: an installed app whose status bar inset reads 0.

const sizes = [
  { name: 'iPad landscape', viewport: { width: 1194, height: 834 }, band: 56, bottom: 20 },
  { name: 'phone portrait', viewport: { width: 390, height: 844 }, band: 92, bottom: 34 },
] as const;

const grounds = { dark: 'rgb(15, 18, 16)', light: 'rgb(244, 245, 241)' } as const;
const surfaces = { dark: 'rgb(22, 26, 23)', light: 'rgb(255, 255, 255)' } as const;

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
  for (const scheme of ['dark', 'light'] as const) {
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
        expect(colours.token.toLowerCase()).toBe(scheme === 'dark' ? '#0f1210' : '#f4f5f1');
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
    });
  }
}

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

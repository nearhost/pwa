import { readFileSync } from 'node:fs';
import { expect, outsideTheApp, test, type Page } from './test.js';
import { envelope, fakeApi } from './fake-api.js';
import { session } from '../src/lib/api/testing.js';
import { canvas } from './fixtures.js';
import { schemes, sizes } from './sizes.js';

const appVersion = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

const grounds = { dark: 'rgb(17, 16, 19)', light: 'rgb(246, 244, 246)' } as const;
const themeColors = { dark: '#111013', light: '#f6f4f6' } as const;

// Playwright cannot emulate display-mode: this makes the app's matchMedia query match, as in
// shell.spec.ts.
async function emulateStandalone(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (!/display-mode:\s*standalone/.test(query)) return real(query);
      return Object.defineProperties(real('all'), {
        matches: { value: true },
        media: { value: query },
      });
    };
  });
}

const themeColorContents = (page: Page) =>
  page
    .locator('meta[name="theme-color"]')
    .evaluateAll((metas) => metas.map((m) => m.getAttribute('content')));

const devices = (page: Page) => page.locator('main [data-devices] > li');

for (const size of sizes) {
  for (const scheme of schemes) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme });

      test('this machine: how it serves, its version and its paired devices', async ({ page }) => {
        await fakeApi(page, { session: { device: 'iPad Pro' } });
        await page.goto('/machine');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('This machine');
        await expect(main.getByRole('heading', { name: 'leto', level: 2 })).toBeVisible();
        const facts = main.locator('[data-facts]');
        await expect(facts.locator('dt')).toHaveText([
          'Status',
          'Page address',
          'Projects',
          'Certificates',
          'Version',
        ]);
        await expect(facts.locator('dd')).toHaveText([
          'Serving on the network',
          'nearhost.lab.example.dev',
          '*.lab.example.dev',
          "Let's Encrypt",
          `Nearhost 0.17.0 · app ${appVersion}`,
        ]);

        await expect(main.getByRole('heading', { name: 'Paired devices' })).toBeVisible();
        await expect(main.getByText('Pair another with nearhost pair on leto')).toBeVisible();
        await expect(devices(page)).toHaveCount(2);
        await expect(devices(page).nth(0)).toContainText('iPad Pro');
        await expect(devices(page).nth(0)).toContainText('this device');
        await expect(devices(page).nth(0).getByRole('button')).toHaveAccessibleName(
          'Unpair this device',
        );
        await expect(devices(page).nth(1)).toContainText('Phone');
        await expect(devices(page).nth(1)).not.toContainText('this device');
        await expect(devices(page).nth(1).getByRole('button')).toHaveAccessibleName('Revoke Phone');

        await expect(main.getByRole('heading', { name: 'On this device' })).toBeVisible();
        // Each group is named by its visible label.
        for (const group of ['Open projects in', 'Document style', 'Appearance']) {
          await expect(main.getByRole('radiogroup', { name: group })).toBeVisible();
        }
        // Nothing runs out sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });

      test('revoking another device asks first, then the list updates', async ({ page }) => {
        const api = await fakeApi(page, { session: { device: 'iPad Pro' } });
        await page.goto('/machine');
        await expect(devices(page)).toHaveCount(2);
        const revoke = page.getByRole('button', { name: 'Revoke Phone' });

        await revoke.click();
        const dialog = page.getByRole('dialog', { name: 'Revoke Phone?' });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Phone will need to pair again');
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
        await expect(revoke).toBeFocused();
        expect(api.requests.some((r) => r.method === 'DELETE')).toBe(false);

        await revoke.click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();

        await revoke.click();
        await dialog.getByRole('button', { name: 'Revoke' }).click();
        await expect(dialog).toBeHidden();
        await expect(devices(page)).toHaveCount(1);
        await expect(devices(page).nth(0)).toContainText('iPad Pro');
        expect(api.requests.filter((r) => r.method === 'DELETE').map((r) => r.path)).toEqual([
          '/api/v1/devices/Phone',
        ]);
        await expect(page.locator('[data-connection]')).toHaveText('Live');
      });

      test('a refused revoke says why and keeps the device', async ({ page }) => {
        const api = await fakeApi(page, { session: { device: 'iPad Pro' } });
        api.on('DELETE /api/v1/devices/Phone', () => ({
          status: 500,
          body: { error: 'Could not save', title: 'Could not save the devices', status: 500 },
        }));
        await page.goto('/machine');
        await page.getByRole('button', { name: 'Revoke Phone' }).click();
        const dialog = page.getByRole('dialog', { name: 'Revoke Phone?' });
        await dialog.getByRole('button', { name: 'Revoke' }).click();
        await expect(dialog.getByRole('alert')).toHaveText(/Could not save the devices/);
        await expect(dialog.getByRole('button', { name: 'Revoke' })).toBeEnabled();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(devices(page)).toHaveCount(2);
      });

      test('while the answer is on its way, the dialog stays open', async ({ page }) => {
        const api = await fakeApi(page, { session: { device: 'iPad Pro' } });
        let answer: () => void = () => {};
        // As the core's, once answered: the device is gone.
        api.on(
          'DELETE /api/v1/devices/Phone',
          () =>
            new Promise((resolve) => {
              answer = () => {
                api.devices = api.devices.filter((d) => d.name !== 'Phone');
                resolve({ status: 204 });
              };
            }),
        );
        await page.goto('/machine');
        await page.getByRole('button', { name: 'Revoke Phone' }).click();
        const dialog = page.getByRole('dialog', { name: 'Revoke Phone?' });
        await dialog.getByRole('button', { name: 'Revoke' }).click();
        await expect(dialog.getByRole('button', { name: 'Revoking…' })).toBeDisabled();
        // A second Escape the browser won't let the page cancel closes a dialog itself.
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
        answer();
        await expect(dialog).toBeHidden();
        await expect(devices(page)).toHaveCount(1);
        // And it opens again afterwards.
        await page.getByRole('button', { name: 'Unpair this device' }).click();
        await expect(page.getByRole('dialog', { name: 'Unpair this device?' })).toBeVisible();
      });

      test('unpairing this device lands on Not paired', async ({ page }) => {
        const api = await fakeApi(page, { session: { device: 'iPad Pro' } });
        await page.goto('/machine');
        await page.getByRole('button', { name: 'Unpair this device' }).click();
        const dialog = page.getByRole('dialog', { name: 'Unpair this device?' });
        await expect(dialog).toContainText('nearhost pair');
        await dialog.getByRole('button', { name: 'Unpair' }).click();
        await expect(page.locator('[data-connection]')).toHaveText('Not paired');
        const heading = page
          .locator('main')
          .getByRole('heading', { name: 'Pair this device with leto' });
        await expect(heading).toBeVisible();
        await expect(heading).toBeFocused();
        expect(api.requests.filter((r) => r.method === 'DELETE').map((r) => r.path)).toEqual([
          '/api/v1/devices/iPad%20Pro',
        ]);
      });

      test('revoking waits for the connection, and says why', async ({ page }) => {
        const api = await fakeApi(page, { session: { device: 'iPad Pro' } });
        await page.goto('/machine');
        await expect(devices(page)).toHaveCount(2);
        // The machine stays out of reach: each try to reconnect fails.
        api.on('GET /api/v1/state', () => ({
          status: 503,
          body: { error: 'Unavailable', title: 'Unavailable', status: 503 },
        }));
        await api.drop();
        await expect(page.locator('[data-connection]')).toHaveText("Can't reach leto");
        const revoke = page.getByRole('button', { name: 'Revoke Phone' });
        await expect(revoke).toBeDisabled();
        await expect(revoke).toHaveAttribute('aria-describedby', 'connection-reason');
        await expect(page.locator('#connection-reason')).toContainText(
          'revoking and unpairing wait until',
        );
        // What the core last said stays, labelled by the notice.
        await expect(devices(page)).toHaveCount(2);
        // The settings are this device's own and still change.
        await page.getByRole('radio', { name: 'Browser' }).click();
        await expect(page.getByRole('radio', { name: 'Browser' })).toHaveAttribute(
          'aria-checked',
          'true',
        );
      });

      test('each setting persists and takes effect', async ({ page }) => {
        await fakeApi(page, { state: canvas });
        await page.goto('/machine');
        const other = scheme === 'dark' ? 'light' : 'dark';
        const label = other === 'dark' ? 'Dark' : 'Light';

        // Appearance: the theme and the browser's theme-color follow.
        await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute(
          'aria-checked',
          'true',
        );
        expect(await themeColorContents(page)).toEqual([themeColors.dark, themeColors.light]);
        await page.getByRole('radio', { name: label }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', other);
        await expect(page.locator('body')).toHaveCSS('background-color', grounds[other]);
        expect(await themeColorContents(page)).toEqual([themeColors[other], themeColors[other]]);

        // Documents.
        await page.getByRole('radio', { name: 'As written' }).click();

        // Open projects in: Preview opens the project's own address.
        await page.getByRole('radio', { name: 'Browser' }).click();

        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', other);
        expect(await themeColorContents(page)).toEqual([themeColors[other], themeColors[other]]);
        for (const name of [label, 'As written', 'Browser']) {
          await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
        }
        expect(
          await page.evaluate(() => [
            localStorage.getItem('nearhost.appearance'),
            localStorage.getItem('nearhost.documentsTheme'),
            localStorage.getItem('nearhost.openProjectsIn'),
          ]),
        ).toEqual([other, 'written', 'browser']);

        await page.getByRole('link', { name: 'Overview' }).filter({ visible: true }).click();
        await expect(
          page.locator('main').getByRole('link', { name: 'Preview storefront' }).first(),
        ).toHaveAttribute('href', 'https://storefront.lab.example.dev');

        // Back to System and The app.
        await page.goto('/machine');
        await page.getByRole('radio', { name: 'System' }).click();
        await page.getByRole('radio', { name: 'The app' }).click();
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
        await expect(page.locator('body')).toHaveCSS('background-color', grounds[scheme]);
        expect(await themeColorContents(page)).toEqual([themeColors.dark, themeColors.light]);
        await page.getByRole('link', { name: 'Overview' }).filter({ visible: true }).click();
        await expect(
          page.locator('main').getByRole('link', { name: 'Preview storefront' }).first(),
        ).toHaveAttribute('href', '/projects/storefront');
      });

      test('a radio group moves with the arrow keys', async ({ page }) => {
        await fakeApi(page);
        await page.goto('/machine');
        const app = page.getByRole('radio', { name: 'The app' });
        await app.focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('radio', { name: 'Browser' })).toBeFocused();
        await expect(page.getByRole('radio', { name: 'Browser' })).toHaveAttribute(
          'aria-checked',
          'true',
        );
      });

      test('in a browser tab, not paired says how to pair and install', async ({ page }) => {
        await fakeApi(page, { signedOut: true });
        await page.goto('/machine');
        await expect(page.locator('[data-connection]')).toHaveText('Not paired');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Pair this device');
        await expect(main).toContainText('nearhost pair');
        await expect(main).toContainText('Add to Home Screen');
        await expect(main).toContainText('Install app');
        await expect(main.getByRole('link', { name: 'Type the code' })).toHaveAttribute(
          'href',
          '/pair',
        );
        // Nothing of the screen it replaced.
        await expect(main.getByRole('heading', { name: 'This machine' })).toHaveCount(0);
      });

      test('installed, not paired says to type the code', async ({ page }) => {
        await emulateStandalone(page);
        await fakeApi(page, { signedOut: true });
        await page.goto('/');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Pair this device');
        await expect(main).toContainText('Type the code nearhost pair printed');
        await expect(main).not.toContainText('Add to Home Screen');
        await expect(main.getByRole('link', { name: 'Type the code' })).toHaveAttribute(
          'href',
          '/pair',
        );
      });
    });
  }
}

test('on a core that does not serve the network, no devices pair', async ({ page }) => {
  const api = await fakeApi(page, { session: { networked: false, device: '' }, network: null });
  await page.goto('/machine');
  const facts = page.locator('main [data-facts]');
  await expect(facts.locator('dd').first()).toHaveText('Serving on this machine only');
  await expect(page.locator('main')).toContainText("leto doesn't serve the network");
  expect(api.requests.some((r) => r.path === '/api/v1/devices')).toBe(false);
});

test('a config that stops serving the network shows at once, the new name too', async ({
  page,
}) => {
  const api = await fakeApi(page);
  await page.goto('/machine');
  await expect(page.locator('[data-connection]')).toHaveText('Live');
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
  // The core applies a config that turns networked mode off and names the machine kronos.
  api.on('GET /api/v1/session', () => ({
    body: session({ networked: false, device: '', machine: 'kronos' }),
  }));
  await api.send(envelope(2, { kind: 'config' }));
  await expect(page.locator('main')).toContainText("kronos doesn't serve the network");
});

// The core's page host answers only this machine, and gates it with the page cookie: a 401 there
// means the cookie is missing, and pairing is beside the point. Chromium resolves *.localhost to
// this machine by itself.
test('signed out at nearhost.localhost, it points at the page address', async ({
  page,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== 'chromium', 'only Chromium resolves *.localhost by itself');
  outsideTheApp('another origin, where the worker installed for the test is not');
  await fakeApi(page, { signedOut: true });
  const port = new URL(baseURL!).port;
  await page.goto(`http://nearhost.localhost:${port}/machine`);
  const main = page.locator('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(
    "Open Nearhost's page from this machine first",
  );
  await expect(main).toContainText('nearhost status');
  await expect(main.getByRole('link', { name: 'Type the code' })).toHaveCount(0);
  await expect(main).not.toContainText('Add to Home Screen');
});

import { expect, test, type Page } from '@playwright/test';

// Fails the test on any Content Security Policy violation or page error, so the app is known to
// boot under the CSP the core sends.
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

test('the home page renders the app', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Nearhost' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a deep link renders the app too', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/some/deep/link');
  await expect(page.getByRole('heading', { level: 1, name: 'Nearhost' })).toBeVisible();
  expect(errors).toEqual([]);
});

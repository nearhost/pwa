import { defineConfig, devices } from '@playwright/test';

// A fixed port of its own, so it never meets another project's preview server.
const port = 4187;

export default defineConfig({
  testDir: 'tests',
  workers: 2,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: `http://localhost:${port}`,
    // The fake core is route mocks, and Playwright's WebKit doesn't route the requests of a page a
    // service worker controls, though the worker leaves them to the network. So the app's worker
    // is kept out, except in tests/offline.spec.ts, which is about it.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
});

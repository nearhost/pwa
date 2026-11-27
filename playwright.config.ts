import { defineConfig, devices } from '@playwright/test';

// A fixed port of its own, so it never meets another project's preview server.
const port = 4187;

export default defineConfig({
  testDir: 'tests',
  workers: 2,
  forbidOnly: !!process.env.CI,
  use: { baseURL: `http://localhost:${port}` },
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

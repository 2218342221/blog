import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4321';
const prefix = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '');
const basePath = prefix ? `/${prefix}/` : '/';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4321 --ignore-lock',
    url: `${baseURL}${basePath}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

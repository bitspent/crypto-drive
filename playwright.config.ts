import { defineConfig, devices } from "@playwright/test";

// Port for the app under test. Override with E2E_PORT=xxxx.
// Locally an already-running server is reused; CI always starts a fresh one.
const E2E_PORT = process.env.E2E_PORT ?? "43127";
const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // The app keeps sessions in a file-backed store; serial runs keep them deterministic.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: ["**/mobile.spec.ts"],
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ["**/layout.spec.ts", "**/mobile.spec.ts", "**/walk.spec.ts"],
    },
  ],
  webServer: {
    command: `npx next start --port ${E2E_PORT}`,
    url: `${BASE_URL}/unlock`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

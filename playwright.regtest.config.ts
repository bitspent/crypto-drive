import { defineConfig, devices } from "@playwright/test";

// Regtest-link project: the app boots with BITCOIN_MODE=regtest against a
// stub infra-api (booted by the spec itself on STUB_PORT). This covers the
// explorer-link-present branch of tx details, unreachable in simulated mode.
// Run: npm run test:e2e:regtest (needs `npm run build` first, like test:e2e).
const E2E_PORT = process.env.E2E_PORT ?? "43207";
const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["**/regtest-*.spec.ts"],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "regtest",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npx next start --port ${E2E_PORT}`,
    url: `${BASE_URL}/unlock`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      CERT_HASH_SECRET: "e2e-test-secret-not-for-production",
      ALLOW_DEMO_LICENSES: "1",
      BITCOIN_MODE: "regtest",
      INFRA_BASE_URL: "http://127.0.0.1:43981",
      INFRA_SHARED_SECRET: "test-stub",
      ADMIN_MINE_TOKEN: "test-stub",
    },
  },
});

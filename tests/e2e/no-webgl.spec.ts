// No-WebGL: with the GPU fully disabled the 2D illustration path renders
// and no canvas element appears anywhere.
import { chromium, expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("renders the 2D path with no canvas", async ({}, testInfo) => {
  const baseURL =
    testInfo.project.use.baseURL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? "43127"}`;
  const headed = await chromium.launch({
    args: ["--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage"],
  });
  try {
    const page = await headed.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(30000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err).slice(0, 200)));
    await unlock(page, uniqueEmail("nogl"), baseURL);
    await page.goto(`${baseURL}/track/bitcoin/what-is/satoshi`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("h1");
    await page.waitForSelector(".drive-layout");
    expect(
      await page.evaluate(() => {
        const c = document.createElement("canvas");
        return c.getContext("webgl2") ?? c.getContext("webgl");
      }),
    ).toBeNull();
    expect(await page.locator("canvas").count()).toBe(0);
    expect(errors, errors.join("\n")).toEqual([]);
  } finally {
    await headed.close();
  }
});

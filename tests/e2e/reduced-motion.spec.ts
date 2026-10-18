// Reduced motion: with prefers-reduced-motion, no animation runs and the
// end poses pin (stage opacity 1, no transforms left mid-flight).
import { expect, test, type Browser } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("freezes animation and pins end poses", async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    await unlock(page, uniqueEmail("rm"));
    await page.goto("/track/bitcoin/what-is/satoshi", { waitUntil: "networkidle" });
    await page.waitForSelector("h1");
    await page.waitForSelector(".drive-layout");
    await page.waitForTimeout(2500); // let anything still animated reveal itself

    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      document.querySelectorAll(".drive-layout *").forEach((el) => {
        if (getComputedStyle(el).animationName !== "none") {
          bad.push(`${el.tagName}.${(el.getAttribute("class") ?? "").slice(0, 40)}`);
        }
      });
      return bad.slice(0, 10);
    });
    expect(offenders, `animated under reduced-motion: ${offenders.join(", ")}`).toEqual([]);

    const stageEnter = page.locator(".stage-enter").first();
    if ((await stageEnter.count()) > 0) {
      expect(await stageEnter.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
  } finally {
    await context.close();
  }
});

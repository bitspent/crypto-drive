// Layout contract: the left column (and the illustration card inside it)
// must not extend past the drive-head width. Runs once per project viewport
// (desktop 1440x900, mobile 390x844), in both themes.
import { expect, test, type Page } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

const SLUGS = ["satoshi", "scarce", "block", "halving", "sats", "cheques", "change"];

type Rect = { l: number; r: number; w: number };

async function measure(page: Page): Promise<{ head: Rect; left: Rect; stage: Rect }> {
  return page.evaluate(() => {
    const r = (el: Element | null): Rect => {
      const b = (el ?? document.body).getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) };
    };
    return {
      head: r(document.querySelector(".drive-head")),
      left: r(document.querySelector(".drive-split > :first-child")),
      stage: r(document.querySelector(".toy-stage")),
    };
  });
}

async function isDark(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

test("left column and illustration stay within the drive head", async ({ page }) => {
  await unlock(page, uniqueEmail("layout"));
  for (const theme of ["default", "toggled"] as const) {
    if (theme === "toggled") {
      const before = await isDark(page);
      await page.getByRole("button", { name: /Switch to (light|dark) mode/ }).click();
      await page.waitForFunction((was: boolean) => {
        return document.documentElement.classList.contains("dark") !== was;
      }, before);
    }
    for (const slug of SLUGS) {
      await page.goto(`/track/bitcoin/what-is/${slug}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".toy-stage");
      const m = await measure(page);
      expect(m.left.r, `${theme} ${slug}: left.r=${m.left.r} head.r=${m.head.r}`).toBeLessThanOrEqual(
        m.head.r + 1,
      );
      expect(
        m.stage.r,
        `${theme} ${slug}: stage.r=${m.stage.r} head.r=${m.head.r}`,
      ).toBeLessThanOrEqual(m.head.r + 1);
    }
  }
});

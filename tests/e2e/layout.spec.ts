// Layout contract: the rail is a narrow top-anchored column (desktop) or a
// drawer trigger (mobile), and content never exceeds the drive-head width.
// Runs once per project viewport (desktop 1440x900, mobile 390x844), in both themes.
import { test, type Page } from "@playwright/test";
import { expectLayoutContract, uniqueEmail, unlock } from "./helpers";

const SLUGS = ["satoshi", "scarce", "block", "halving", "sats", "cheques", "change"];

async function isDark(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

test("rail stays top-anchored and content stays within the drive head", async ({ page }) => {
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
      await expectLayoutContract(page, `${theme} what-is/${slug}`);
    }
  }
});

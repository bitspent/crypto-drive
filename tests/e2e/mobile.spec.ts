// Mobile smoke (runs on the mobile project only): a step renders a single
// column with the rail behind a Route drawer trigger, never the 3D stage.
import { expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("renders single column with the rail in a drawer", async ({ page }) => {
  await unlock(page, uniqueEmail("mob"));
  await page.goto("/track/bitcoin/what-is/block", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await page.waitForSelector(".drive-layout");
  await expect(page.locator("nav.drive-rail")).toBeHidden();
  await expect(page.getByRole("button", { name: "Route" })).toBeVisible();
  expect(await page.locator(".journey-stage").count()).toBe(0);
});

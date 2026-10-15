// Mobile smoke (runs on the mobile project only): a step renders the 2D
// illustration card and never mounts the 3D stage.
import { expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("renders the 2D illustration card", async ({ page }) => {
  await unlock(page, uniqueEmail("mob"));
  await page.goto("/track/bitcoin/what-is/block", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await page.waitForSelector(".toy-stage");
  expect(await page.locator(".journey-stage").count()).toBe(0);
});

// License counter: the form keeps its exact contract while the gate gains
// the physical licence — holder mirror, class menu, demo hint.
import { expect, test } from "@playwright/test";
import {
  assertNoPageErrors,
  collectPageErrors,
  unlock,
  uniqueEmail,
} from "./helpers";

let failures: string[] = [];
test.beforeEach(async ({ page }) => {
  failures = collectPageErrors(page);
  await page.goto("/unlock");
});

test.afterEach(() => {
  assertNoPageErrors(failures);
});

test("the counter shows the licence card and the three classes", async ({
  page,
}) => {
  await expect(page.getByText("THE LICENSE COUNTER")).toBeVisible();
  await expect(page.getByTestId("license-card")).toBeVisible();
  await expect(page.getByTestId("class-row")).toHaveCount(3);
  const certified = page
    .getByTestId("class-row")
    .filter({ hasText: "Certified Practitioner" });
  await expect(certified.getByTestId("class-recommended")).toHaveText(
    "Recommended",
  );
  await expect(
    page.getByRole("region", { name: "License counter" }),
  ).toBeVisible();
});

test("typing the holder email mirrors onto the card", async ({ page }) => {
  const email = uniqueEmail("mirror");
  await page.fill("#email", email);
  await expect(page.getByTestId("license-holder")).toHaveText(email);
});

test("the demo hint names the default key", async ({ page }) => {
  await expect(page.getByTestId("demo-hint")).toContainText("CD-DRIVE-2026");
});

test("a demo key still unlocks to the course", async ({ page }) => {
  await unlock(page, uniqueEmail("counter"));
  await page.waitForURL("**/course");
  await expect(page.getByTestId("track-bookshelf")).toBeVisible();
});

test("a wrong key shows the counter's error, not a redirect", async ({
  page,
}) => {
  await page.fill("#email", uniqueEmail("wrong"));
  await page.fill("#license", "CD-DRIVE-NOPE-123");
  await page.getByRole("button", { name: "Unlock my tier" }).click();
  // Next's route announcer also carries role=alert; scope to the form's error.
  await expect(page.locator('p[role="alert"]')).toContainText("didn’t unlock");
  await expect(page).toHaveURL(/\/unlock$/);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the card renders flat and the form still takes input", async ({
    page,
  }) => {
    await expect(page.getByTestId("license-card")).toBeVisible();
    const email = uniqueEmail("still");
    await page.fill("#email", email);
    await expect(page.getByTestId("license-holder")).toHaveText(email);
  });
});

test("no horizontal scroll at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

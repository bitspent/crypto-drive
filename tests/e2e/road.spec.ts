// The track road: route shields on one lane, the car pinned to the current
// stop, and a pennant that turns green once every stop is passed.
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoPageErrors,
  collectPageErrors,
  uniqueEmail,
  unlock,
} from "./helpers";

test.setTimeout(240_000);

let failures: string[] = [];
test.beforeEach(async ({ page }) => {
  failures = collectPageErrors(page);
  await unlock(page, uniqueEmail("road"));
});

test.afterEach(() => {
  assertNoPageErrors(failures);
});

async function clearTickets(page: Page, picks: [string, string][]): Promise<void> {
  for (const [id, name] of picks) {
    await page
      .getByRole("group", { name: `ticket ${id}` })
      .getByRole("button", { name, exact: true })
      .click();
  }
}

async function commitForward(page: Page, buttonName: string, urlPart: string): Promise<void> {
  await page.getByRole("button", { name: buttonName }).click();
  try {
    await page.waitForURL(`**/${urlPart}`, { timeout: 8000 });
  } catch {
    await page.getByRole("link", { name: "Continue", exact: true }).click();
    await page.waitForURL(`**/${urlPart}`);
  }
}

test("a fresh road pins the car to stop one and locks the rest", async ({
  page,
}) => {
  await page.goto("/track/bitcoin");
  await expect(page.getByTestId("road-map")).toBeVisible();
  const stops = page.locator(".road-stop");
  await expect(stops).toHaveCount(6);
  await expect(stops.nth(0)).toHaveAttribute("data-state", "here");
  for (let i = 1; i < 6; i++) {
    await expect(stops.nth(i)).toHaveAttribute("data-state", "locked");
  }
  await expect(page.getByTestId("road-you")).toHaveText("You are here");
  await expect(page.getByRole("link", { name: "Start the drive" })).toBeVisible();
  await expect(page.locator(".road-finish")).toHaveAttribute("data-arrived", "false");
});

test("the first stop card opens the drive at its first screen", async ({
  page,
}) => {
  await page.goto("/track/bitcoin");
  await page.getByRole("link", { name: /What Bitcoin is/ }).click();
  await page.waitForURL("**/track/bitcoin/what-is/satoshi");
});

test("walking the primer passes its stop and plants the flag", async ({
  page,
}) => {
  const answers: Record<string, [string, string][]> = {
    do: [
      ["t1", "Small coins and notes"],
      ["t2", "Coins and notes in a tin box"],
      ["t3", "The same unit of counting"],
    ],
    melt: [
      ["t1", "Prices rose while the jar sat still"],
      ["t2", "Cash folded in a drawer"],
      ["t3", "People holding cash savings"],
    ],
    promise: [
      ["t1", "A promise between banks, settled later"],
      ["t2", "Numbers in the bank's promise ledger"],
      ["t3", "It lent the promises out and keeps only a fraction"],
    ],
    distance: [
      ["t1", "Fees and the exchange-rate cut"],
      ["t2", "Agent A: 8% fee, arrives in 3 days"],
      ["t3", "Money arriving before the pharmacy closes"],
    ],
    bearer: [
      ["t1", "A banknote in your hand"],
      ["t2", "Holding it IS owning it — no account to ask"],
      ["t3", "Bitcoin, held in your own wallet"],
    ],
  };
  const legs: [keyof typeof answers, string, string][] = [
    ["do", "Test the five jobs", "first/melt"],
    ["melt", "Feel the melt", "first/promise"],
    ["promise", "Follow the promise", "first/distance"],
    ["distance", "Price the road", "first/bearer"],
  ];

  await page.goto("/track/money-map");
  await page.getByRole("link", { name: "Start the drive" }).click();
  await page.waitForURL("**/first/do");
  for (const [slug, button, next] of legs) {
    await clearTickets(page, answers[slug]);
    await commitForward(page, button, next);
  }
  await clearTickets(page, answers.bearer);
  await page.getByRole("button", { name: "Start the Bitcoin road" }).click();
  await page.getByRole("link", { name: "Back to your course" }).click();
  await page.waitForURL("**/course");

  await page.goto("/track/money-map");
  const stop = page.locator(".road-stop").first();
  await expect(stop).toHaveAttribute("data-state", "done");
  await expect(page.locator(".road-finish")).toHaveAttribute("data-arrived", "true");
  await expect(page.getByText("You finished this drive.")).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the road renders without the pulse", async ({ page }) => {
    await page.goto("/track/bitcoin");
    const shield = page.locator(".road-stop[data-state='here'] .road-shield");
    await expect(shield).toHaveCSS("animation-name", "none");
    await expect(page.getByTestId("road-you")).toHaveText("You are here");
  });
});

test("no horizontal scroll at 320 px", async ({ page }) => {
  await page.goto("/track/bitcoin");
  await page.setViewportSize({ width: 320, height: 600 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

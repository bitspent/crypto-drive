// Money primer walk: unlock -> all 5 primer steps -> handoff to the course.
// The primer carries no certificate: the last step commits into /course,
// where the Bitcoin road waits.
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoPageErrors,
  collectPageErrors,
  expectLayoutContract,
  uniqueEmail,
  unlock,
} from "./helpers";

test.setTimeout(180_000);

// Every step carries a pocket card: commit may stay and show a Continue link.
async function commitAndContinue(page: Page, buttonName: string, urlPart: string): Promise<void> {
  await page.getByRole("button", { name: buttonName }).click();
  try {
    await page.waitForURL(`**/${urlPart}`, { timeout: 8000 });
  } catch {
    await page.getByRole("link", { name: "Continue", exact: true }).click();
    await page.waitForURL(`**/${urlPart}`);
  }
}

async function clearTickets(page: Page, picks: [string, string][]): Promise<void> {
  for (const [id, name] of picks) {
    await page
      .getByRole("group", { name: `ticket ${id}` })
      .getByRole("button", { name, exact: true })
      .click();
  }
}

test("walks unlock through all 5 primer steps to the course handoff", async ({ page }) => {
  const failures = collectPageErrors(page);
  // A legitimate full walk must never trip rate limits.
  const throttled: string[] = [];
  page.on("response", (res) => {
    if (res.status() === 429) throttled.push(res.url());
  });
  await unlock(page, uniqueEmail("money"));
  await page.getByRole("link", { name: "Money map — not opened" }).click();
  await page.waitForURL("**/track/money-map");
  await expect(page.getByText("0 / 1 stops done")).toBeVisible();
  await page.getByRole("link", { name: "Start the drive" }).click();
  await page.waitForURL("**/first/do");

  // Quick checks render from step one: wrong pick shows ✗, right pick shows ✓.
  const doWrong = page.getByRole("radio", { name: "It stopped splitting" });
  await doWrong.click();
  await expect(doWrong).toContainText("✗");
  const doRight = page.getByRole("radio", { name: "It stopped holding value" });
  await doRight.click();
  await expect(doRight).toContainText("✓");

  // do: a wrong ticket pick teaches and retries, then the reads clear.
  const t1 = page.getByRole("group", { name: "ticket t1" });
  await t1.getByRole("button", { name: "A live goat", exact: true }).click();
  await expect(t1.locator('[role="alert"]')).toBeVisible();
  await clearTickets(page, [
    ["t1", "Small coins and notes"],
    ["t2", "Coins and notes in a tin box"],
    ["t3", "The same unit of counting"],
  ]);
  await expectLayoutContract(page, "first/do");
  await commitAndContinue(page, "Test the five jobs", "first/melt");

  await clearTickets(page, [
    ["t1", "Prices rose while the jar sat still"],
    ["t2", "Cash folded in a drawer"],
    ["t3", "People holding cash savings"],
  ]);
  await commitAndContinue(page, "Feel the melt", "first/promise");

  await clearTickets(page, [
    ["t1", "A promise between banks, settled later"],
    ["t2", "Numbers in the bank's promise ledger"],
    ["t3", "It lent the promises out and keeps only a fraction"],
  ]);
  await commitAndContinue(page, "Follow the promise", "first/distance");

  await clearTickets(page, [
    ["t1", "Fees and the exchange-rate cut"],
    ["t2", "Agent A: 8% fee, arrives in 3 days"],
    ["t3", "Money arriving before the pharmacy closes"],
  ]);
  await commitAndContinue(page, "Price the road", "first/bearer");

  await expectLayoutContract(page, "first/bearer");
  await clearTickets(page, [
    ["t1", "A banknote in your hand"],
    ["t2", "Holding it IS owning it — no account to ask"],
    ["t3", "Bitcoin, held in your own wallet"],
  ]);
  // Last step: commit hands back to the course, where the Bitcoin road waits.
  await page.getByRole("button", { name: "Start the Bitcoin road" }).click();
  await page.getByRole("link", { name: "Back to your course" }).click();
  await page.waitForURL("**/course");
  await expect(
    page.getByRole("link", { name: "Money map — done" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Bitcoin/ }).first()).toBeVisible();

  assertNoPageErrors(failures);
  expect(throttled, throttled.join("\n")).toEqual([]);
});

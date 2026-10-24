// USDT walk: unlock -> all 10 stablecoin steps -> certificate -> verify page.
// Mirrors walk.spec.ts (same player, second track): every network-pick ticket
// cleared in the scene, server re-grades on commit.
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoPageErrors,
  collectPageErrors,
  expectLayoutContract,
  uniqueEmail,
  unlock,
} from "./helpers";

test.setTimeout(180_000);

const MILESTONE =
  "Can recognize USDT networks, verify deposit addresses, and refuse mismatched withdrawals.";

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

test("walks unlock to verified USDT certificate across all 10 steps", async ({ page }) => {
  const failures = collectPageErrors(page);
  // A legitimate full walk must never trip rate limits.
  const throttled: string[] = [];
  page.on("response", (res) => {
    if (res.status() === 429) throttled.push(res.url());
  });
  await unlock(page, uniqueEmail("usdt"));
  await page.getByRole("link", { name: /USDT \+ networks/ }).click();
  await page.waitForURL("**/track/usdt-networks");
  await expect(page.getByText("0 / 3 stops done")).toBeVisible();
  await page.getByRole("link", { name: "Start the drive" }).click();
  await page.waitForURL("**/one-coin/erc");

  // erc: wrong pick teaches and retries, then the reads clear.
  const t1 = page.getByRole("group", { name: "ticket t1" });
  await t1.getByRole("button", { name: "Tron (TRC-20)", exact: true }).click();
  await expect(t1.locator('[role="alert"]', { hasText: /read the prefix/ })).toBeVisible();
  await clearTickets(page, [
    ["t1", "Ethereum (ERC-20)"],
    ["t2", "Ethereum (ERC-20)"],
    ["t3", "Tron (TRC-20)"],
  ]);
  await commitAndContinue(page, "Check my reads", "one-coin/trc");

  await clearTickets(page, [
    ["t1", "Tron (TRC-20)"],
    ["t2", "Tron (TRC-20)"],
    ["t3", "Ethereum (ERC-20)"],
  ]);
  await commitAndContinue(page, "Check my reads", "one-coin/rule");

  await clearTickets(page, [
    ["t1", "Ethereum (ERC-20)"],
    ["t2", "Tron (TRC-20)"],
    ["t3", "Bitcoin (legacy Omni)"],
    ["t4", "Ethereum (ERC-20)"],
  ]);
  await commitAndContinue(page, "Check my reads", "picker/deposit");

  // deposit + withdraw: approve the agreements, refuse the mismatches.
  await clearTickets(page, [
    ["d1", "Approve"],
    ["d2", "Refuse"],
    ["d3", "Approve"],
    ["d4", "Refuse"],
  ]);
  await commitAndContinue(page, "Clear the queue", "picker/withdraw");

  await clearTickets(page, [
    ["w1", "Approve"],
    ["w2", "Refuse"],
    ["w3", "Approve"],
    ["w4", "Refuse"],
  ]);
  await commitAndContinue(page, "Clear the queue", "picker/fees");

  await clearTickets(page, [
    ["f1", "Ethereum"],
    ["f2", "Tron"],
    ["f3", "ETH"],
  ]);
  await commitAndContinue(page, "Check my reads", "picker/custody");

  // custody: same four models as Bitcoin — expand all, pick multi-sig.
  for (const model of ["Exchange", "Self-custody", "Institutional custodian", "Multi-sig"]) {
    await page.getByRole("button", { name: model }).click();
  }
  await page
    .getByRole("group", { name: /without a third party/ })
    .getByRole("radio", { name: "Multi-sig", exact: true })
    .check();
  await page.getByRole("button", { name: "I've compared the models" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/road/explorer");

  await clearTickets(page, [
    ["e1", "Etherscan"],
    ["e2", "Tronscan"],
    ["e3", "mempool.space"],
  ]);
  await commitAndContinue(page, "Check my reads", "road/save");

  await clearTickets(page, [
    ["s1", "Approve"],
    ["s2", "Approve"],
    ["s3", "Refuse"],
    ["s4", "Refuse"],
  ]);
  await commitAndContinue(page, "Clear the queue", "road/capstone");

  // capstone: mixed queue, then the USDT certificate issues here.
  await expectLayoutContract(page, "road/capstone");
  await clearTickets(page, [
    ["c1", "Approve"],
    ["c2", "Refuse"],
    ["c3", "Approve"],
    ["c4", "Refuse"],
  ]);
  await page.getByRole("button", { name: "Finish the road test" }).click();
  await page.locator("#name").waitFor();
  await page.fill("#name", "Stablecoin Driver");
  await Promise.all([
    page.waitForURL("**/cert/**"),
    page.getByRole("button", { name: "Issue my certificate" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Certificate ready, Stablecoin." })).toBeVisible();
  await expect(page.getByText(MILESTONE)).toBeVisible();
  const verifyLink = page.locator('a[href^="/verify/"]').first();
  await expect(verifyLink).toHaveCount(1);
  await verifyLink.click();
  await page.waitForURL("**/verify/**");
  await expect(page.getByRole("heading", { name: "Stablecoin Driver" })).toBeVisible();
  await expect(page.getByText(MILESTONE)).toBeVisible();

  assertNoPageErrors(failures);
  expect(throttled, throttled.join("\n")).toEqual([]);
});

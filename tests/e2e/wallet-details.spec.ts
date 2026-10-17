// Wallet: transaction details sheet. A history row opens a dialog with the
// full tx facts (amount, counterparty, txid + copy, confirmations, block,
// date, fee/memo when present). Simulated mode has no chain, so a confirmed
// tx shows "Simulated" for the block; regtest fills the real height.
import { expect, test, type Page } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

type Tx = { id: string; counterparty: string };

async function readyWallet(page: Page, prefix: string): Promise<void> {
  await unlock(page, uniqueEmail(prefix));
  const res = await page.request.post("/api/wallet");
  expect(res.ok()).toBe(true);
}

async function deposit(page: Page): Promise<Tx> {
  const res = await page.request.post("/api/wallet/deposit");
  expect(res.ok()).toBe(true);
  const data = (await res.json()) as { tx: Tx };
  return data.tx;
}

async function tick(page: Page, txid: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    const res = await page.request.post("/api/wallet/tick", { data: { txid } });
    expect(res.ok()).toBe(true);
  }
}

test("pending deposit opens details, copies the txid, and returns focus", async ({
  page,
}) => {
  await readyWallet(page, "wdetails");
  const tx = await deposit(page);
  await page.goto("/wallet");

  await page.getByRole("button", { name: /Show details/ }).click();
  const dialog = page.getByRole("dialog", { name: "Transaction details" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();

  // Truncated txid + counterparty, pending state, no block yet.
  const frag = `${tx.id.slice(0, 6)}…${tx.id.slice(-6)}`;
  await expect(dialog.getByText(frag)).toBeVisible();
  const confRow = dialog.locator(".w-tx-row", { hasText: "Confirmations" });
  await expect(confRow.getByText("0/3")).toBeVisible();
  const blockRow = dialog.locator(".w-tx-row", { hasText: "Block" });
  await expect(blockRow.getByText("Pending")).toBeVisible();
  await expect(dialog.getByText(/0\.005.*BTC/)).toBeVisible();

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Copy transaction ID" }).click();
  await expect(dialog.getByText("Copied.")).toBeVisible();
  const pasted = await page.evaluate(() => navigator.clipboard.readText());
  expect(pasted).toBe(tx.id);

  // Escape closes and focus returns to the row that opened it.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Show details/ })).toBeFocused();
});

test("confirmed deposit shows a simulated block", async ({ page }) => {
  await readyWallet(page, "wdetailsconf");
  const tx = await deposit(page);
  await tick(page, tx.id, 3);
  await page.goto("/wallet");

  await page.getByRole("button", { name: /Show details/ }).click();
  const dialog = page.getByRole("dialog", { name: "Transaction details" });
  await expect(dialog).toBeVisible();
  const confRow = dialog.locator(".w-tx-row", { hasText: "Confirmations" });
  await expect(confRow.getByText("Confirmed")).toBeVisible();
  const blockRow = dialog.locator(".w-tx-row", { hasText: "Block" });
  await expect(blockRow.getByText("Simulated")).toBeVisible();
  // No fee row on an incoming tx.
  await expect(dialog.getByText("Fee", { exact: true })).toBeHidden();
});

test("sent tx shows fee and memo rows", async ({ page }) => {
  await readyWallet(page, "wdetailssend");
  const dep = await deposit(page);
  await tick(page, dep.id, 3);
  const send = await page.request.post("/api/wallet/send", {
    data: {
      to: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      amountSats: 100000,
      feeTier: "standard",
      memo: "rent split",
    },
  });
  expect(send.ok()).toBe(true);
  await page.goto("/wallet");

  await page.getByRole("button", { name: /Sent.*Show details/ }).click();
  const dialog = page.getByRole("dialog", { name: "Transaction details" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("rent split")).toBeVisible();
  await expect(dialog.getByText(/700 sats/)).toBeVisible();
});

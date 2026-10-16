// Wallet Flow 4: settings gear -> backup (reveal + 3/7/11 -> backupAt),
// restore (warn -> 12 slots -> match/mismatch, never mutates), reset (RESET).
import { expect, test, type Page } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

type Ready = { address: string; seedWords: string[] };

async function readyWallet(page: Page, fund: boolean): Promise<Ready> {
  await unlock(page, uniqueEmail("wbackup"));
  const created = await page.request.post("/api/wallet");
  expect(created.ok()).toBe(true);
  const data = (await created.json()) as {
    wallet: { address: string; seedWords: string[] };
  };
  if (fund) {
    const dep = await page.request.post("/api/wallet/deposit");
    expect(dep.ok()).toBe(true);
    const { tx } = (await dep.json()) as { tx: { id: string } };
    for (let i = 0; i < 3; i++) {
      const tick = await page.request.post("/api/wallet/tick", {
        data: { txid: tx.id },
      });
      expect(tick.ok()).toBe(true);
    }
  }
  await page.goto("/wallet");
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  return { address: data.wallet.address, seedWords: data.wallet.seedWords };
}

async function readRevealWords(page: Page): Promise<string[]> {
  const cells = page.locator(".w-seed-cell");
  await expect(cells).toHaveCount(12);
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const text = (await cells.nth(i).innerText()).trim().split(/\s+/);
    words.push(text[text.length - 1] ?? "");
  }
  return words;
}

async function confirmThreeSevenEleven(page: Page, words: string[]): Promise<void> {
  for (const n of [3, 7, 11]) {
    await expect(page.getByText(`Tap word ${n}`)).toBeVisible();
    await page.getByRole("button", { name: words[n - 1] as string, exact: true }).click();
  }
}

async function openRestoreForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("menuitem", { name: "Restore a wallet" }).click();
  const dialog = page.getByRole("dialog", { name: "Restore a wallet" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      "This replaces your current wallet. You'll lose the practice balance if you don't have the words. Continue?",
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Word 1", { exact: true })).toBeVisible();
}

test("settings gear hides until a wallet exists", async ({ page }) => {
  await unlock(page, uniqueEmail("wbackup"));
  await page.goto("/wallet");
  await expect(page.getByRole("button", { name: "Create your wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0);
});

test("backup completes and stamps backupAt", async ({ page }) => {
  await readyWallet(page, false);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("menuitem", { name: "Back up your wallet" }).click();
  await expect(page.getByRole("heading", { name: "Your 12 words" })).toBeVisible();

  const words = await readRevealWords(page);
  const proceed = page.getByRole("button", { name: "I've written them down" });
  await expect(page.locator(".w-seed-word").first()).toContainText("•", { timeout: 10000 });
  await proceed.click();
  await confirmThreeSevenEleven(page, words);

  await expect(page.getByText(/Backed up on .+\./)).toBeVisible();
  await page.getByRole("button", { name: "Back to wallet" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText(/Last backed up: /)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText(/Last backed up: /)).toBeVisible();
});

test("restore with correct words reports the same wallet", async ({ page }) => {
  const { seedWords } = await readyWallet(page, true);
  await openRestoreForm(page);
  for (let i = 0; i < 12; i++) {
    await page.getByLabel(`Word ${i + 1}`, { exact: true }).fill(seedWords[i] as string);
  }
  await page.getByRole("button", { name: "Check words" }).click();
  await expect(
    page.getByText("Same wallet. Same address. Same balance."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".w-history-row")).toHaveCount(1);
  await expect(page.locator(".w-balance")).toContainText("0.005");
});

test("restore with wrong words fails safely", async ({ page }) => {
  const { seedWords } = await readyWallet(page, true);
  await openRestoreForm(page);
  for (let i = 0; i < 12; i++) {
    await page.getByLabel(`Word ${i + 1}`, { exact: true }).fill(i === 5 ? "wrongword" : (seedWords[i] as string));
  }
  await page.getByRole("button", { name: "Check words" }).click();
  await expect(
    page.getByText("Those don't match your saved words. Nothing changed."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".w-history-row")).toHaveCount(1);
  await expect(page.locator(".w-balance")).toContainText("0.005");
});

test("paste-all in slot 1 fills every slot", async ({ page }) => {
  const { seedWords } = await readyWallet(page, false);
  await openRestoreForm(page);
  await page.getByLabel("Word 1", { exact: true }).fill(seedWords.join(" "));
  await expect(page.getByLabel("Word 12", { exact: true })).toHaveValue(seedWords[11] as string);
  await page.getByRole("button", { name: "Check words" }).click();
  await expect(
    page.getByText("Same wallet. Same address. Same balance."),
  ).toBeVisible();
});

test("reset clears and re-setup reproduces the address", async ({ page }) => {
  const { address } = await readyWallet(page, true);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("menuitem", { name: "Reset wallet" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset wallet" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Type RESET to confirm.")).toBeVisible();

  const confirm = dialog.getByRole("button", { name: "Reset wallet", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type RESET to confirm").fill("reset");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type RESET to confirm").fill("RESET");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole("button", { name: "Create your wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0);

  await page.getByRole("button", { name: "Create your wallet" }).click();
  await expect(page.getByRole("heading", { name: "Your 12 words" })).toBeVisible();
  const words = await readRevealWords(page);
  await expect(page.locator(".w-seed-word").first()).toContainText("•", { timeout: 10000 });
  await page.getByRole("button", { name: "I've written them down" }).click();
  await confirmThreeSevenEleven(page, words);
  await expect(page.getByRole("button", { name: "Receive" })).toBeVisible();

  const res = await page.request.get("/api/wallet");
  expect(res.ok()).toBe(true);
  const data = (await res.json()) as { wallet: { address: string } };
  expect(data.wallet.address).toBe(address);
});

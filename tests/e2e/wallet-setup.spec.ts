// Wallet Flow 1: empty state -> create -> seed reveal (+5s mask) ->
// 3/7/11 confirm -> ready. Plus reload persistence and seed coherence.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

async function readSeedWords(page: Page): Promise<string[]> {
  const cells = page.locator(".w-seed-cell");
  await expect(cells).toHaveCount(12);
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const text = (await cells.nth(i).innerText()).trim().split(/\s+/);
    words.push(text[text.length - 1] ?? "");
  }
  return words;
}

test("setup walks empty state to a ready wallet", async ({ page }) => {
  await unlock(page, uniqueEmail("wsetup"));
  await page.goto("/wallet");
  await page.getByRole("button", { name: "Create your wallet" }).click();
  await expect(page.getByRole("heading", { name: "Your 12 words" })).toBeVisible();

  const words = await readSeedWords(page);
  expect(new Set(words).size).toBe(12);

  const proceed = page.getByRole("button", { name: "I've written them down" });
  await expect(proceed).toBeDisabled();
  await expect(page.locator(".w-seed-word").first()).not.toContainText("•", {
    timeout: 4000,
  });
  // Auto-mask lands ~5s after first reveal.
  await expect(page.locator(".w-seed-word").first()).toContainText("•", { timeout: 10000 });
  await expect(proceed).toBeEnabled();
  await page.getByRole("button", { name: "Show them again" }).click();
  await expect(page.locator(".w-seed-word").first()).not.toContainText("•");
  await proceed.click();

  // Wrong tap first: inline error, retry allowed.
  await expect(page.getByText("Tap word 3")).toBeVisible();
  const wrong = words[0] === words[2] ? (words[1] as string) : (words[0] as string);
  await page.getByRole("button", { name: wrong, exact: true }).click();
  await expect(page.getByText("That's not word 3.")).toBeVisible();
  for (const n of [3, 7, 11]) {
    await expect(page.getByText(`Tap word ${n}`)).toBeVisible();
    await page.getByRole("button", { name: words[n - 1] as string, exact: true }).click();
  }

  // Ready: balance 0, empty history, actions present.
  await expect(page.getByRole("button", { name: "Receive" })).toBeVisible();
  await expect(page.getByText("No activity yet.")).toBeVisible();
});

test("confirm focuses each new prompt and tracks Word N of 3", async ({ page }) => {
  await unlock(page, uniqueEmail("wsetupfocus"));
  await page.goto("/wallet");
  await page.getByRole("button", { name: "Create your wallet" }).click();
  const words = await readSeedWords(page);
  const proceed = page.getByRole("button", { name: "I've written them down" });
  await expect(page.locator(".w-seed-word").first()).toContainText("•", { timeout: 10000 });
  await page.getByRole("button", { name: "Show them again" }).click();
  await proceed.click();

  // Round 1: three dots, first current, prompt unfocused on entry.
  const dots = page.locator(".w-confirm-dot");
  await expect(dots).toHaveCount(3);
  await expect(dots.nth(0)).toHaveClass(/w-confirm-dot-current/);
  await expect(page.getByText("Word 1 of 3")).toBeVisible();

  // Correct tap advances: new prompt rises, takes focus, dots follow.
  await page.getByRole("button", { name: words[2] as string, exact: true }).click();
  const prompt7 = page.getByText("Tap word 7");
  await expect(prompt7).toBeVisible();
  await expect(prompt7).toBeFocused();
  await expect(page.getByText("Word 2 of 3")).toBeVisible();
  await expect(dots.nth(0)).toHaveClass(/w-confirm-dot-done/);
  await expect(dots.nth(1)).toHaveClass(/w-confirm-dot-current/);
  await expect(dots.nth(2)).not.toHaveClass(/w-confirm-dot-(done|current)/);

  await page.getByRole("button", { name: words[6] as string, exact: true }).click();
  const prompt11 = page.getByText("Tap word 11");
  await expect(prompt11).toBeVisible();
  await expect(prompt11).toBeFocused();
  await expect(page.getByText("Word 3 of 3")).toBeVisible();
});

test("reload after setup lands on the wallet, never the reveal", async ({ page }) => {
  await unlock(page, uniqueEmail("wsetup"));
  await page.goto("/wallet");
  await page.getByRole("button", { name: "Create your wallet" }).click();
  await expect(page.getByRole("heading", { name: "Your 12 words" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Receive" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your 12 words" })).toHaveCount(0);
});

test("wallet reuses the drive seed, address, and words", async ({ page }) => {
  await unlock(page, uniqueEmail("wsetup"));
  await page.getByRole("link", { name: /Continue Bitcoin|Bitcoin road/ }).click();
  await page.waitForURL("**/what-is/satoshi");
  for (const [btn, frag] of [
    ["Show me how scarce it is", "what-is/scarce"],
    ["How do new coins appear?", "what-is/block"],
    ["Does that pay stay the same?", "what-is/halving"],
    ["What is a satoshi?", "what-is/sats"],
    ["Show me my balance", "what-is/cheques"],
  ] as const) {
    await page.getByRole("button", { name: btn }).click();
    await page.waitForURL(`**/${frag}`);
  }
  const items = page.locator("li", { hasText: /Cheque \d/ });
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const text = await items.nth(i).innerText();
    const m = text.match(/(\d+\.\d+)/);
    expect(m).not.toBeNull();
    sum += Number(m?.[1] ?? "0");
  }
  await page.fill("#cheques-total", (Math.round(sum * 10000) / 10000).toFixed(4));
  await page.getByRole("button", { name: "That is my balance" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/what-is/change");
  await page.getByRole("button", { name: "Sign and send" }).click();
  await page.getByRole("button", { name: "Got it — let me get paid" }).click();
  try {
    await page.waitForURL("**/get-paid/address", { timeout: 8000 });
  } catch {
    await page.getByRole("link", { name: "Continue", exact: true }).click();
    await page.waitForURL("**/get-paid/address");
  }
  const plate = (await page.locator("p.break-all.font-mono").first().innerText()).trim();
  const res = await page.request.post("/api/wallet");
  expect(res.ok()).toBe(true);
  const data = (await res.json()) as {
    wallet: { address: string; seedWords: string[]; balance: number; exists: boolean };
  };
  expect(data.wallet.exists).toBe(true);
  expect(data.wallet.address).toBe(plate);
  expect(data.wallet.balance).toBe(0);
  expect(data.wallet.seedWords).toHaveLength(12);
  expect(new Set(data.wallet.seedWords).size).toBe(12);
});

test("reduced motion pins the mask and shake to state changes", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    await unlock(page, uniqueEmail("wsetup"));
    await page.goto("/wallet");
    await page.getByRole("button", { name: "Create your wallet" }).click();
    await expect(page.locator(".w-seed-word").first()).toContainText("•", { timeout: 10000 });
    const transition = await page
      .locator(".w-seed-word")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transition).toBe("0s");
    await page.getByRole("button", { name: "Show them again" }).click();
    const cells = page.locator(".w-seed-cell");
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      seen.push((await cells.nth(i).innerText()).trim().split(/\s+/).pop() ?? "");
    }
    const third = seen[2] as string;
    const wrongOne = seen.find((w) => w !== third) as string;
    await page.getByRole("button", { name: "I've written them down" }).click();
    await page.getByRole("button", { name: wrongOne, exact: true }).click();
    await expect(page.getByText("That's not word 3.")).toBeVisible();
    const animation = await page
      .locator(".w-confirm-grid")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
    // The focus motion pins too: prompt, number pulse, current dot.
    for (const sel of [".w-confirm-prompt", ".w-confirm-num", ".w-confirm-dot-current"]) {
      const name = await page.locator(sel).evaluate((el) => getComputedStyle(el).animationName);
      expect(name).toBe("none");
    }
    // ... but the state still advances: dots and focus follow the round.
    await page.getByRole("button", { name: third, exact: true }).click();
    await expect(page.getByText("Tap word 7")).toBeFocused();
    await expect(page.getByText("Word 2 of 3")).toBeVisible();
  } finally {
    await context.close();
  }
});

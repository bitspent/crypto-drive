// Wallet Flow 3: Send form (address/amount/memo/fee) -> review sheet with
// last-6 checkbox -> sign shimmer -> pending out tx -> confirmed.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

const RECIPIENT = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";

async function fundedWallet(page: Page): Promise<void> {
  await unlock(page, uniqueEmail("wsend"));
  const created = await page.request.post("/api/wallet");
  expect(created.ok()).toBe(true);
  const dep = await page.request.post("/api/wallet/deposit");
  expect(dep.ok()).toBe(true);
  const { tx } = (await dep.json()) as { tx: { id: string } };
  for (let i = 0; i < 3; i++) {
    const tick = await page.request.post("/api/wallet/tick", {
      data: { txid: tx.id },
    });
    expect(tick.ok()).toBe(true);
  }
  await page.goto("/wallet");
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.locator(".w-balance")).toContainText("0.005");
}

async function fillValidForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("dialog", { name: "Send bitcoin" }).waitFor();
  await page.getByLabel("Recipient address").fill(RECIPIENT);
  await page.getByLabel("Amount (BTC)").fill("0.001");
  await expect(page.getByText("≈ 100,000 sats")).toBeVisible();
}

test("send walks form to review to a confirmed outgoing tx", async ({ page }) => {
  await fundedWallet(page);
  await fillValidForm(page);
  await expect(page.getByLabel("Standard")).toBeChecked();
  await expect(
    page.getByText("Small test first. Send a little before you send a lot."),
  ).toBeVisible();
  await expect(page.getByText("The fee comes out of the same balance.")).toBeVisible();

  await page.getByRole("button", { name: "Review" }).click();
  const review = page.getByRole("dialog", { name: "Review and send" });
  await expect(review).toBeVisible();
  await expect(review.getByText("bc1qw5…v8f3t4")).toBeVisible();
  await expect(review.getByText("0.001 BTC (100,000 sats)")).toBeVisible();
  await expect(review.getByText("0.000007 BTC (700 sats)")).toBeVisible();
  await expect(review.getByText("0.001007 BTC")).toBeVisible();
  await expect(review.getByText("0.003993 BTC")).toBeVisible();
  await expect(
    review.getByText("There's no undo. Check the recipient's last 6 characters."),
  ).toBeVisible();

  const sign = review.getByRole("button", { name: "Sign and send" });
  await expect(sign).toBeDisabled();
  await review.getByLabel("I checked the last 6 characters.").check();
  await expect(sign).toBeEnabled();
  await sign.click();

  await expect(review).toHaveCount(0);
  await expect(page.getByText("Sent")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("−0.001 000 00 BTC")).toBeVisible();
  await expect(page.locator(".w-balance")).toContainText("0.003", { timeout: 5000 });
  await expect(page.getByText("Confirmed")).toHaveCount(2, { timeout: 20000 });
});

test("validation blocks bad address, empty amount, and short funds", async ({
  page,
}) => {
  await fundedWallet(page);
  await page.getByRole("button", { name: "Send" }).click();
  const dialog = page.getByRole("dialog", { name: "Send bitcoin" });
  await expect(dialog).toBeVisible();

  await page.getByLabel("Recipient address").fill("0xabc");
  await page.getByLabel("Amount (BTC)").click();
  await expect(
    page.getByText("That doesn't look like a Bitcoin address. It should start with bc1."),
  ).toBeVisible();

  await page.getByLabel("Amount (BTC)").fill("5");
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Not enough. Don't forget the fee.")).toBeVisible();

  await page.getByLabel("Amount (BTC)").fill("");
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Enter an amount.")).toBeVisible();

  await expect(page.getByRole("dialog", { name: "Review and send" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".w-history-row")).toHaveCount(1);
  await expect(page.locator(".w-balance")).toContainText("0.005");
});

test("cancel closes review without side effects", async ({ page }) => {
  await fundedWallet(page);
  await fillValidForm(page);
  await page.getByRole("button", { name: "Review" }).click();
  const review = page.getByRole("dialog", { name: "Review and send" });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Cancel" }).click();
  await expect(review).toHaveCount(0);
  await expect(page.locator(".w-history-row")).toHaveCount(1);
  await expect(page.locator(".w-balance")).toContainText("0.005");
});

test("keyboard walks the send form and toggles the checkbox", async ({ page }) => {
  await fundedWallet(page);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("dialog", { name: "Send bitcoin" })).toBeVisible();

  await expect(page.getByLabel("Recipient address")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Paste" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Amount (BTC)")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Memo (optional)")).toBeFocused();

  await page.getByLabel("Recipient address").fill(RECIPIENT);
  await page.getByLabel("Amount (BTC)").fill("0.001");
  await page.getByRole("button", { name: "Review" }).click();
  const review = page.getByRole("dialog", { name: "Review and send" });
  await expect(review).toBeVisible();
  const box = review.getByLabel("I checked the last 6 characters.");
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await expect(review.getByRole("button", { name: "Sign and send" })).toBeEnabled();
});

test("sign stays in view on a small viewport", async ({ page }) => {
  await fundedWallet(page);
  await fillValidForm(page);
  await page.getByRole("button", { name: "Review" }).click();
  const review = page.getByRole("dialog", { name: "Review and send" });
  await expect(review).toBeVisible();
  await expect(review.getByRole("button", { name: "Sign and send" })).toBeInViewport();
});

test("reduced motion pins the sign shimmer to a state change", async ({
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
    await fundedWallet(page);
    await fillValidForm(page);
    const sheetAnimation = await page
      .locator(".w-sheet")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(sheetAnimation).toBe("none");
    await page.getByRole("button", { name: "Review" }).click();
    const review = page.getByRole("dialog", { name: "Review and send" });
    await expect(review).toBeVisible();
    await review.getByLabel("I checked the last 6 characters.").check();
    await review.getByRole("button", { name: "Sign and send" }).click();
    const shimmer = await page.evaluate(() => {
      const el = document.querySelector(".w-signing");
      if (!el) return "instant";
      return getComputedStyle(el, "::after").display;
    });
    expect(["instant", "none"]).toContain(shimmer);
    await expect(page.getByText("Sent")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Confirmed")).toHaveCount(2, { timeout: 20000 });
  } finally {
    await context.close();
  }
});

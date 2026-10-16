// Wallet Flow 2: Receive sheet (QR/copy/caption) -> close -> incoming
// deposit slides in pending -> confirmations tick 0/3..3/3 -> confirmed.
// Setup itself is covered by wallet-setup.spec.ts, so this spec creates the
// wallet through the API and exercises the deposit UI from a ready wallet.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

async function readyWallet(page: Page): Promise<{ address: string }> {
  await unlock(page, uniqueEmail("wdeposit"));
  const res = await page.request.post("/api/wallet");
  expect(res.ok()).toBe(true);
  const data = (await res.json()) as { wallet: { address: string } };
  await page.goto("/wallet");
  await expect(page.getByRole("button", { name: "Receive" })).toBeVisible();
  return { address: data.wallet.address };
}

test("receive sheet shows QR, full address, and a working copy chip", async ({
  page,
}) => {
  const { address } = await readyWallet(page);
  await page.getByRole("button", { name: "Receive" }).click();

  const dialog = page.getByRole("dialog", { name: "Your address" });
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Bitcoin only. Not for any other coin.")).toBeVisible();
  await expect(
    page.getByText("Your address is safe to share. That's the point."),
  ).toBeVisible();
  await expect(dialog.getByText(address)).toBeVisible();

  const qr = dialog.getByAltText(/QR code for /);
  await expect(qr).toBeVisible();
  // Layout pixels are fractional while the sheet entrance settles, so the
  // box check is tolerant; the intrinsic bitmap size is exact.
  const size = await qr.evaluate((el) => {
    const img = el as HTMLImageElement;
    const box = img.getBoundingClientRect();
    return {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      width: box.width,
      height: box.height,
    };
  });
  expect(size.naturalWidth).toBe(240);
  expect(size.naturalHeight).toBe(240);
  expect(size.width).toBeCloseTo(240, 0);
  expect(size.height).toBeCloseTo(240, 0);

  // Focus lands on Close when the sheet opens.
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Copy address" }).click();
  await expect(dialog.getByText("Copied.")).toBeVisible();
  const pasted = await page.evaluate(() => navigator.clipboard.readText());
  expect(pasted).toBe(address);

  // Escape closes and focus returns to Receive.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Receive" })).toBeFocused();
});

test("deposit arrives after close and ticks 0/3 to confirmed", async ({ page }) => {
  await readyWallet(page);
  await page.getByRole("button", { name: "Receive" }).click();
  await page.getByRole("button", { name: "Close" }).click();

  await expect(page.getByText("Received")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("+0.005 000 00 BTC")).toBeVisible();
  await expect(page.locator(".w-history-row")).toHaveCount(1);

  await expect(
    page.getByText("Confirmations make a payment harder to reverse."),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Confirmed")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".w-balance")).toContainText("0.005", { timeout: 5000 });
  await expect(page.locator(".w-balance-sub")).toContainText("500,000 sats");
  await expect(
    page.getByText("You don't do anything. The balance updates itself."),
  ).toBeVisible();
});

test("reload mid-tick resumes confirmations without a second deposit", async ({
  page,
}) => {
  await readyWallet(page);
  await page.getByRole("button", { name: "Receive" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Received")).toBeVisible({ timeout: 10000 });

  await page.reload();
  await expect(page.locator(".w-history-row")).toHaveCount(1);
  await expect(page.getByText("Confirmed")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".w-history-row")).toHaveCount(1);
  await expect(page.locator(".w-balance")).toContainText("0.005");
});

test("reduced motion pins deposit animation to state changes", async ({
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
    await readyWallet(page);
    await page.getByRole("button", { name: "Receive" }).click();
    const sheetAnimation = await page
      .locator(".w-sheet")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(sheetAnimation).toBe("none");
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("Received")).toBeVisible({ timeout: 10000 });
    const rowAnimation = await page
      .locator(".w-history-row")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(rowAnimation).toBe("none");
    const badgeAnimation = await page
      .locator(".w-badge-pending")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(badgeAnimation).toBe("none");

    await expect(page.getByText("Confirmed")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".w-balance")).toContainText("0.005");
  } finally {
    await context.close();
  }
});

// In-course wallet modal: the full practice wallet in a dialog, opened from
// the rail (desktop) or the route drawer (mobile). No navigation — the step
// stays alive underneath and re-syncs on close.
import { expect, test, type Browser, type Locator } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

const STEP = "/track/bitcoin/what-is/satoshi";

async function readSeedWords(modal: Locator): Promise<string[]> {
  const cells = modal.locator(".w-seed-cell");
  await expect(cells).toHaveCount(12);
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const text = (await cells.nth(i).innerText()).trim().split(/\s+/);
    words.push(text[text.length - 1] ?? "");
  }
  return words;
}

test("rail opens the wallet in place, setup works, close returns focus", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await unlock(page, uniqueEmail("wmodal"));
    await page.goto(STEP, { waitUntil: "networkidle" });
    const trigger = page
      .locator(".drive-layout > nav.drive-rail")
      .getByRole("button", { name: "Practice wallet" });
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox?.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const modal = page.getByRole("dialog", { name: "Practice wallet" });
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/\/what-is\/satoshi/);
    // Bare mode: disclosure row, no duplicate wallet title.
    await expect(modal.locator(".w-topbar-bare")).toBeVisible();
    await expect(modal.locator(".w-topbar-bare .w-disclosure")).toBeVisible();
    await expect(modal.locator(".w-topbar-bare > span")).toHaveCount(0);
    // Light glass backdrop.
    const veilFilter = await page.evaluate(
      () => getComputedStyle(document.querySelector(".wallet-modal-veil") as Element).backdropFilter,
    );
    expect(veilFilter).toContain("blur(");

    // Compact default cap (undragged class rule) + slim scrollbars + frame.
    expect(await modal.evaluate((el) => getComputedStyle(el).maxHeight)).toBe("640px");
    expect(await modal.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe("thin");
    expect(await modal.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("2px");

    // Draggable by the header on desktop: stays in the viewport.
    const before = await modal.boundingBox();
    const head = modal.locator(".wallet-modal-head");
    const headBox = await head.boundingBox();
    await page.mouse.move((headBox?.x ?? 0) + 20, (headBox?.y ?? 0) + (headBox?.height ?? 0) / 2);
    await page.mouse.down();
    await page.mouse.move((headBox?.x ?? 0) + 140, (headBox?.y ?? 0) + 100, { steps: 8 });
    await page.mouse.up();
    const after = await modal.boundingBox();
    expect((after?.x ?? 0) - (before?.x ?? 0)).toBeGreaterThan(100);
    expect((after?.y ?? 0) - (before?.y ?? 0)).toBeGreaterThan(50);
    expect(after?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((after?.x ?? 0) + (after?.width ?? 0)).toBeLessThanOrEqual(1440);

    // Corner grip resizes both dimensions.
    const grown = await modal.boundingBox();
    await page.mouse.move(
      (grown?.x ?? 0) + (grown?.width ?? 0) - 6,
      (grown?.y ?? 0) + (grown?.height ?? 0) - 6,
    );
    await page.mouse.down();
    await page.mouse.move((grown?.x ?? 0) + (grown?.width ?? 0) + 74, (grown?.y ?? 0) + (grown?.height ?? 0) + 54, {
      steps: 8,
    });
    await page.mouse.up();
    const resized = await modal.boundingBox();
    expect((resized?.width ?? 0) - (grown?.width ?? 0)).toBeGreaterThan(60);
    expect((resized?.height ?? 0) - (grown?.height ?? 0)).toBeGreaterThan(40);

    // Full setup ceremony inside the modal.
    await modal.getByRole("button", { name: "Create your wallet" }).click();
    await expect(modal.getByRole("heading", { name: "Your 12 words" })).toBeVisible();
    const words = await readSeedWords(modal);
    expect(new Set(words).size).toBe(12);
    const proceed = modal.getByRole("button", { name: "I've written them down" });
    await expect(modal.locator(".w-seed-word").first()).toContainText("•", { timeout: 10000 });
    await modal.getByRole("button", { name: "Show them again" }).click();
    await proceed.click();
    for (const n of [3, 7, 11]) {
      await expect(modal.getByText(`Tap word ${n}`)).toBeVisible();
      await modal.getByRole("button", { name: words[n - 1] ?? "", exact: true }).click();
    }
    await expect(modal.getByRole("button", { name: "Receive" })).toBeVisible();

    await modal.getByRole("button", { name: "Close wallet" }).click();
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/what-is\/satoshi/);
  } finally {
    await context.close();
  }
});

test("Escape closes a nested wallet sheet before the modal, focus stays trapped", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await unlock(page, uniqueEmail("wmodalesc"));
    const created = await page.request.post("/api/wallet");
    expect(created.ok()).toBe(true);
    await page.goto(STEP, { waitUntil: "networkidle" });
    const trigger = page
      .locator(".drive-layout > nav.drive-rail")
      .getByRole("button", { name: "Practice wallet" });
    await trigger.click();
    const modal = page.getByRole("dialog", { name: "Practice wallet" });
    await expect(modal.getByRole("button", { name: "Receive" })).toBeVisible();
    // Bare home row: disclosure left, gear right, same line.
    const bareRow = modal.locator(".w-topbar-bare");
    await expect(bareRow).toBeVisible();
    const row = await bareRow.boundingBox();
    const gear = modal.getByRole("button", { name: "Settings" });
    const gearBox = await gear.boundingBox();
    const note = modal.locator(".w-topbar-bare .w-disclosure");
    const noteBox = await note.boundingBox();
    expect(noteBox?.x ?? 0).toBeLessThan(gearBox?.x ?? 0);
    expect(Math.abs((noteBox?.y ?? 0) - (gearBox?.y ?? 0))).toBeLessThan(row?.height ?? 0);
    // Inline styling actually applied (left, no hairlines) — geometry alone
    // would pass on the base centered strip.
    expect(await note.evaluate((el) => getComputedStyle(el).textAlign)).toBe("left");
    expect(await note.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");

    // Trap: tabbing never leaves the modal.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest(".wallet-modal"),
      );
      expect(inside).toBe(true);
    }

    // First Escape closes the sheet only; the modal survives it.
    await modal.getByRole("button", { name: "Receive" }).click();
    const sheet = modal.getByRole("dialog", { name: "Your address" });
    await expect(sheet).toBeVisible();
    // Contained: the sheet overlay sits inside the modal box, not the viewport.
    const overlayBox = await modal.locator(".w-overlay").boundingBox();
    const modalBox = await modal.boundingBox();
    expect(overlayBox?.x ?? -1).toBeGreaterThanOrEqual((modalBox?.x ?? 0) - 1);
    expect(overlayBox?.y ?? -1).toBeGreaterThanOrEqual((modalBox?.y ?? 0) - 1);
    expect((overlayBox?.x ?? 0) + (overlayBox?.width ?? 0)).toBeLessThanOrEqual(
      (modalBox?.x ?? 0) + (modalBox?.width ?? 0) + 1,
    );
    expect((overlayBox?.y ?? 0) + (overlayBox?.height ?? 0)).toBeLessThanOrEqual(
      (modalBox?.y ?? 0) + (modalBox?.height ?? 0) + 1,
    );
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(modal).toBeVisible();

    // Second Escape closes the modal and returns focus to the rail trigger.
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
  } finally {
    await context.close();
  }
});

test("drawer opens the wallet as a bottom sheet on mobile", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await unlock(page, uniqueEmail("wmodalmob"));
    await page.goto(STEP, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Route" }).click();
    const drawer = page.getByRole("dialog", { name: "Drive route" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Practice wallet" }).click();
    await expect(drawer).toBeHidden();

    const modal = page.getByRole("dialog", { name: "Practice wallet" });
    await expect(modal).toBeVisible();
    const box = await modal.boundingBox();
    expect(box?.width).toBe(390);
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    await modal.getByRole("button", { name: "Close wallet" }).click();
    await expect(modal).toBeHidden();
  } finally {
    await context.close();
  }
});

// Keyboard drive: Right advances, Left goes back, Up/Down rove focus,
// and arrow keys never hijack typing in a field.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("arrow keys drive, rove focus, and leave typing alone", async ({ page }) => {
  await unlock(page, uniqueEmail("kb"));
  await page.goto("/track/bitcoin/what-is/satoshi", { waitUntil: "networkidle" });

  await page.keyboard.press("ArrowRight"); // primary: commit, step stays + shows Continue
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/what-is/scarce");
  await page.keyboard.press("ArrowLeft"); // back to satoshi
  await page.waitForURL("**/what-is/satoshi");

  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => ({
    text: document.activeElement?.textContent?.trim().slice(0, 40) ?? "",
    inMain: (document.activeElement?.closest("main") ?? null) !== null,
  }));
  expect(focused.text.length).toBeGreaterThan(0);
  expect(focused.inMain).toBe(true);
  await page.keyboard.press("ArrowUp");
  const moved = await page.evaluate(
    (prev: string) => document.activeElement?.textContent?.trim().slice(0, 40) !== prev,
    focused.text,
  );
  expect(moved).toBe(true);

  // Walk up to cheques through the gate (intro commits need no answers).
  // Passed steps show a Continue link; fresh steps show the primary button.
  for (const [btn, frag] of [
    ["Show me how scarce it is", "what-is/scarce"],
    ["How do new coins appear?", "what-is/block"],
    ["Does that pay stay the same?", "what-is/halving"],
    ["What is a satoshi?", "what-is/sats"],
    ["Show me my balance", "what-is/cheques"],
  ] as const) {
    const cont = page.getByRole("link", { name: "Continue", exact: true });
    if ((await cont.count()) > 0) await cont.click();
    else await page.getByRole("button", { name: btn }).click();
    try {
      await page.waitForURL(`**/${frag}`, { timeout: 8000 });
    } catch {
      // Fresh commit stays and shows its own Continue link.
      await page.getByRole("link", { name: "Continue", exact: true }).click();
      await page.waitForURL(`**/${frag}`);
    }
  }

  // Arrow keys must not hijack typing.
  await page.fill("#cheques-total", "0.00");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  expect(await page.inputValue("#cheques-total")).toBe("0.00");
  expect(page.url().endsWith("/cheques")).toBe(true);
});

async function focusZone(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "none";
    if (el.closest(".drive-drawer")) return "drawer";
    if (el.closest("nav.drive-rail")) return "rail";
    if (el.closest(".drive-foot")) return "foot";
    if (el.closest("header")) return "siteheader";
    if (el.closest(".drive-head")) return "head";
    if (el.closest("main .mb-3")) return "backlink";
    if (el.closest("main")) return "content";
    return "other";
  });
}

test("tab order runs header, rail, content, footer", async ({ page }) => {
  // Desktop: the drive-head contributes no stops (progress dots are
  // role=img, Route trigger hidden); every other zone appears in DOM order.
  // Mobile: the rail hides and the Route trigger adds a head stop instead.
  await unlock(page, uniqueEmail("kbtab"));
  await page.goto("/track/bitcoin/what-is/satoshi", { waitUntil: "networkidle" });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: string[] = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    seen.push(await focusZone(page));
  }
  const order = [...new Set(seen.filter((z) => z !== "none" && z !== "other"))];
  const narrow = (page.viewportSize()?.width ?? 1440) < 1024;
  expect(order).toEqual(
    narrow
      ? ["siteheader", "backlink", "head", "content", "foot"]
      : ["siteheader", "backlink", "rail", "content", "foot"],
  );
});

test("route drawer traps focus and returns it on close", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await unlock(page, uniqueEmail("kbdrawer"));
    await page.goto("/track/bitcoin/what-is/block", { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: "Route" });
    await expect(trigger).toBeVisible();
    await expect(page.locator("nav.drive-rail")).toBeHidden();

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Drive route" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close route" })).toBeFocused();
    for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
    expect(await focusZone(page)).toBe("drawer");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    // Close-button path returns focus too.
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "Close route" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  } finally {
    await context.close();
  }
});

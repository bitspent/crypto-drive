// Keyboard drive: Right advances, Left goes back, Up/Down rove focus,
// and arrow keys never hijack typing in a field.
import { expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("arrow keys drive, rove focus, and leave typing alone", async ({ page }) => {
  await unlock(page, uniqueEmail("kb"));
  await page.goto("/track/bitcoin/what-is/satoshi", { waitUntil: "networkidle" });

  await page.keyboard.press("ArrowRight"); // primary: commit + push to scarce
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
    await page.waitForURL(`**/${frag}`);
  }

  // Arrow keys must not hijack typing.
  await page.fill("#cheques-total", "0.00");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  expect(await page.inputValue("#cheques-total")).toBe("0.00");
  expect(page.url().endsWith("/cheques")).toBe(true);
});

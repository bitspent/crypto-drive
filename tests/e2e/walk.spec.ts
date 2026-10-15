// Full walk: unlock -> all 18 steps -> certificate -> verify page.
// Ported from the operator validate.mjs (screenshots dropped, explorer step added:
// the operator script predates the get-paid/explorer lesson).
import { expect, test, type Page } from "@playwright/test";
import { assertNoPageErrors, collectPageErrors, uniqueEmail, unlock } from "./helpers";

test.setTimeout(240_000);

async function clickAndWaitUrl(page: Page, name: string, urlPart: string): Promise<void> {
  await page.getByRole("button", { name }).click();
  await page.waitForURL(`**/${urlPart}`);
}

// For pocket-card steps: commit may stay and show a Continue link instead.
async function commitAndContinue(page: Page, buttonName: string, urlPart: string): Promise<void> {
  await page.getByRole("button", { name: buttonName }).click();
  try {
    await page.waitForURL(`**/${urlPart}`, { timeout: 8000 });
  } catch {
    await page.getByRole("link", { name: "Continue", exact: true }).click();
    await page.waitForURL(`**/${urlPart}`);
  }
}

test("walks unlock to verified certificate across all 18 steps", async ({ page }) => {
  const failures = collectPageErrors(page);
  await unlock(page, uniqueEmail("walk"));
  await page.getByRole("link", { name: /Continue Bitcoin|Bitcoin road/ }).click();
  await page.waitForURL("**/what-is/satoshi");

  // 2D-first: illustration toy present, 3D stage absent.
  await page.waitForSelector(".toy-stage");
  expect(await page.locator(".journey-stage").count()).toBe(0);

  await clickAndWaitUrl(page, "Show me how scarce it is", "what-is/scarce");
  await clickAndWaitUrl(page, "How do new coins appear?", "what-is/block");
  await clickAndWaitUrl(page, "Does that pay stay the same?", "what-is/halving");
  await clickAndWaitUrl(page, "What is a satoshi?", "what-is/sats");
  await clickAndWaitUrl(page, "Show me my balance", "what-is/cheques");

  // cheques: sum the three amounts.
  const items = page.locator("li", { hasText: /Cheque \d/ });
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const text = await items.nth(i).innerText();
    const m = text.match(/(\d+\.\d+)/);
    expect(m, `could not parse cheque ${i + 1} amount`).not.toBeNull();
    sum += Number(m?.[1] ?? "0");
  }
  await page.fill("#cheques-total", (Math.round(sum * 10000) / 10000).toFixed(4));
  await page.getByRole("button", { name: "That is my balance" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/what-is/change");

  await page.getByRole("button", { name: "Sign and send" }).click();
  await commitAndContinue(page, "Got it — let me get paid", "get-paid/address");

  // address: read plate, fill ends.
  const addr = (await page.locator("p.break-all.font-mono").first().innerText()).trim();
  expect(addr.startsWith("bc1")).toBe(true);
  // The commit gate requires tapping copy first ("Copy the address first…").
  await page.getByRole("button", { name: "Copy Bitcoin address" }).click();
  await page.fill("#first4", addr.slice(0, 4));
  await page.fill("#last4", addr.slice(-4));
  await clickAndWaitUrl(page, "That's my address", "get-paid/receipt");

  // receipt: paste txid, wait for landed.
  const receiptChip = await page
    .getByRole("button", { name: "Copy receipt transaction id" })
    .innerText();
  const txidMatch = receiptChip.match(/([0-9a-f]{64})/);
  expect(txidMatch, "could not read receipt txid from copy chip").not.toBeNull();
  const txid = txidMatch?.[1] ?? "";
  await page.fill("#receipt", txid);
  await page.getByRole("button", { name: "Look it up" }).click();
  const landedBtn = page.getByRole("button", { name: "It landed" });
  await landedBtn.waitFor();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find((b) => b.textContent === "It landed")
        ?.disabled,
    undefined,
    { polling: 100 },
  );
  await landedBtn.click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/get-paid/explorer");

  // explorer: three checks on the pizza payment (bounds match PIZZA_EXPLORER).
  await page.getByRole("radio", { name: "Yes" }).check();
  await page.fill("#explorer-confirms", "900000");
  await page.fill("#explorer-fee", "4191");
  await page.getByRole("button", { name: "I checked the explorer" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/send/swapped");

  await page.getByRole("button", { name: "Paste address" }).click();
  await commitAndContinue(page, "Reject this paste", "send/toll");

  await page.getByRole("button", { name: "Slower, cheaper" }).click();
  await commitAndContinue(page, "Send the test", "send/no-undo");

  await page.getByRole("button", { name: "Send the test anyway" }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find((b) => b.textContent === "It landed")
        ?.disabled,
    undefined,
    { polling: 100 },
  );
  await commitAndContinue(page, "It landed", "guard/key");

  await page.getByRole("button", { name: "Share address" }).click();
  await page.getByRole("button", { name: "Share key" }).click();
  await clickAndWaitUrl(page, "I've seen both", "guard/words");

  // words: capture order, tap through, refuse traps, recall.
  const tapFrame = page.locator("p", { hasText: "TAP ONTO THE CARD" }).locator("xpath=..");
  const wordBtns = tapFrame.locator("div.flex-wrap button");
  expect(await wordBtns.count()).toBe(12);
  const words: string[] = [];
  for (let i = 0; i < 12; i++) words.push((await wordBtns.nth(i).innerText()).trim());
  for (let i = 0; i < 12; i++) await wordBtns.nth(i).click();
  await page.getByRole("button", { name: "Card is written" }).click();
  await page.locator("p", { hasText: "YOUR PHONE ASKS" }).waitFor();
  await page.getByRole("button", { name: "Don't save" }).click();
  await page.locator("p", { hasText: "A CHAT POPS UP" }).waitFor();
  await page.getByRole("button", { name: "Refuse" }).click();
  let prevTitle = "";
  for (let round = 0; round < 5; round++) {
    // Race-free: each round waits for EITHER the next WORD title OR the
    // Continue link (WORD 9 persists after the final commit by design).
    const got = await page.waitForFunction(
      (prev: string) => {
        const links = [...document.querySelectorAll("a")];
        if (links.some((a) => (a.textContent ?? "").trim() === "Continue")) return "done";
        const el = [...document.querySelectorAll("p")].find((p) =>
          /WORD \d+/.test(p.textContent ?? ""),
        );
        return el && el.textContent !== prev ? el.textContent : false;
      },
      prevTitle,
      { polling: 100, timeout: 30000 },
    );
    if ((await got.jsonValue()) === "done") break;
    const title = await page.locator("p", { hasText: /WORD \d+/ }).first().innerText();
    prevTitle = title;
    const nm = title.match(/WORD (\d+)/);
    expect(nm, `unexpected recall title: ${title}`).not.toBeNull();
    const n = Number(nm?.[1] ?? "0");
    const recallFrame = page
      .locator("p", { hasText: /WORD \d+/ })
      .first()
      .locator("xpath=..");
    await recallFrame.getByRole("button", { name: words[n - 1] ?? "", exact: true }).click();
  }
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/road-test/support");

  await clickAndWaitUrl(page, "Close the chat", "road-test/network");

  await page.getByRole("button", { name: "Switch to Bitcoin" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/road-test/mismatch");

  await page.getByRole("button", { name: "Stop the send" }).click();
  await page.locator("#name").waitFor();
  await page.fill("#name", "Playwright Driver");
  await Promise.all([
    page.waitForURL("**/cert/**"),
    page.getByRole("button", { name: "Issue my certificate" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Certificate ready, Playwright." })).toBeVisible();
  const verify = page.locator('a[href^="/verify/"]').first();
  await expect(verify).toHaveCount(1);
  await verify.click();
  await page.waitForURL("**/verify/**");
  await expect(page.getByRole("heading", { name: "Playwright Driver" })).toBeVisible();

  assertNoPageErrors(failures);
});

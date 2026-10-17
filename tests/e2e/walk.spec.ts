// Full walk: unlock -> all 18 steps -> certificate -> verify page.
// Ported from the operator validate.mjs (screenshots dropped, explorer step added:
// the operator script predates the get-paid/explorer lesson).
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoPageErrors,
  collectPageErrors,
  expectLayoutContract,
  uniqueEmail,
  unlock,
} from "./helpers";

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

test("walks unlock to verified certificate across all 24 steps", async ({ page }) => {
  const failures = collectPageErrors(page);
  // A legitimate full walk must never trip rate limits.
  const throttled: string[] = [];
  page.on("response", (res) => {
    if (res.status() === 429) throttled.push(res.url());
  });
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
    // Race-free: each round waits for EITHER the next Tap-word prompt OR
    // the Continue link (the last prompt persists after commit by design).
    const got = await page.waitForFunction(
      (prev: string) => {
        const links = [...document.querySelectorAll("a")];
        if (links.some((a) => (a.textContent ?? "").trim() === "Continue")) return "done";
        const el = [...document.querySelectorAll("p")].find((p) =>
          /Tap word \d+/.test(p.textContent ?? ""),
        );
        return el && el.textContent !== prev ? el.textContent : false;
      },
      prevTitle,
      { polling: 100, timeout: 30000 },
    );
    if ((await got.jsonValue()) === "done") break;
    const title = await page.locator("p", { hasText: /Tap word \d+/ }).first().innerText();
    prevTitle = title;
    const nm = title.match(/Tap word (\d+)/);
    expect(nm, `unexpected recall prompt: ${title}`).not.toBeNull();
    const n = Number(nm?.[1] ?? "0");
    const recallFrame = page
      .locator("p", { hasText: /Tap word \d+/ })
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

  // No cert on mismatch anymore: it auto-advances into the capstone.
  await page.getByRole("button", { name: "Stop the send" }).click();
  await page.waitForURL("**/prove-it/verify");

  // verify: same three checks as the explorer lesson, new commit button.
  await expectLayoutContract(page, "prove-it/verify");
  await page.getByRole("radio", { name: "Yes" }).check();
  await page.fill("#explorer-confirms", "900000");
  await page.fill("#explorer-fee", "4191");
  await page.getByRole("button", { name: "I verified the payment" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/prove-it/finality");

  // finality: coffee 0, laptop 3, house 6.
  await expectLayoutContract(page, "prove-it/finality");
  await page.getByRole("radio", { name: "Coffee, $4, in person: 0 confirmations" }).check();
  await page
    .getByRole("radio", { name: "Laptop, $1,800, shipped to a new customer: 3 confirmations" })
    .check();
  await page
    .getByRole("radio", { name: "House deposit, $200,000, wire replacement: 6 confirmations" })
    .check();
  await page.getByRole("button", { name: "Set my policy" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/prove-it/custody");

  // custody: expand all four, pick multi-sig.
  await expectLayoutContract(page, "prove-it/custody");
  for (const model of ["Exchange", "Self-custody", "Institutional custodian", "Multi-sig"]) {
    await page.getByRole("button", { name: model }).click();
  }
  await page.getByRole("radio", { name: "Multi-sig", exact: true }).check();
  await page.getByRole("button", { name: "I've compared the models" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/prove-it/fees");

  // fees: payroll economy, supplier priority.
  await expectLayoutContract(page, "prove-it/fees");
  await page.getByRole("radio", { name: "Payroll batch: Economy" }).check();
  await page.getByRole("radio", { name: "Single supplier payment: Priority" }).check();
  await page.getByRole("button", { name: "Set my fee strategy" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/prove-it/restore");

  // restore: the same 12 words captured at guard/words, in order.
  await expectLayoutContract(page, "prove-it/restore");
  expect(words).toHaveLength(12);
  for (let i = 0; i < 12; i++) {
    await page.getByLabel(`Word ${i + 1}`, { exact: true }).fill(words[i] ?? "");
  }
  await page.getByRole("button", { name: "Restore my wallet" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/prove-it/explain");

  // explain: a valid CFO answer, then the certificate issues here.
  await expectLayoutContract(page, "prove-it/explain");
  await page.fill(
    "#explain-text",
    "Bitcoin settles payments with finality in about ten minutes. Supply is scarce with a fixed supply capped at 21 million coins. We hold the keys in multi-sig custody with a named custodian.",
  );
  await page.getByRole("button", { name: "Make my case" }).click();
  await page.locator("#name").waitFor();
  await page.fill("#name", "Playwright Driver");
  await Promise.all([
    page.waitForURL("**/cert/**"),
    page.getByRole("button", { name: "Issue my certificate" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Certificate ready, Playwright." })).toBeVisible();
  await expect(
    page.getByText(
      "Can receive, verify, send, and custody Bitcoin. Can explain Bitcoin's role to a non-technical stakeholder.",
    ),
  ).toBeVisible();
  const verifyLink = page.locator('a[href^="/verify/"]').first();
  await expect(verifyLink).toHaveCount(1);
  await verifyLink.click();
  await page.waitForURL("**/verify/**");
  await expect(page.getByRole("heading", { name: "Playwright Driver" })).toBeVisible();
  await expect(
    page.getByText(
      "Can receive, verify, send, and custody Bitcoin. Can explain Bitcoin's role to a non-technical stakeholder.",
    ),
  ).toBeVisible();

  assertNoPageErrors(failures);
  expect(throttled, throttled.join("\n")).toEqual([]);
});

// Full walk: unlock -> all 26 steps -> certificate -> verify page.
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

// Every step carries a pocket card: commit may stay and show a Continue link.
async function commitAndContinue(page: Page, buttonName: string, urlPart: string): Promise<void> {
  await page.getByRole("button", { name: buttonName }).click();
  try {
    await page.waitForURL(`**/${urlPart}`, { timeout: 8000 });
  } catch {
    await page.getByRole("link", { name: "Continue", exact: true }).click();
    await page.waitForURL(`**/${urlPart}`);
  }
}

test("walks unlock to verified certificate across all 26 steps", async ({ page }) => {
  const failures = collectPageErrors(page);
  // A legitimate full walk must never trip rate limits.
  const throttled: string[] = [];
  page.on("response", (res) => {
    if (res.status() === 429) throttled.push(res.url());
  });
  await unlock(page, uniqueEmail("walk"));
  // Freshness fixture: a fully-worked wallet completed BEFORE the exam opens.
  // Its evidence must not count once the attempt starts.
  const staleBuild = await page.request.post("/api/wallet");
  expect(staleBuild.ok()).toBe(true);
  const staleWallet = (await staleBuild.json()) as { wallet: { seedWords: string[] } };
  const staleDep = await page.request.post("/api/wallet/deposit");
  expect(staleDep.ok()).toBe(true);
  const { tx: staleTx } = (await staleDep.json()) as { tx: { id: string } };
  for (let i = 0; i < 3; i++) {
    const tick = await page.request.post("/api/wallet/tick", { data: { txid: staleTx.id } });
    expect(tick.ok()).toBe(true);
  }
  const staleSend = await page.request.post("/api/wallet/send", {
    data: {
      to: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      amountSats: 100000,
      feeTier: "economy",
    },
  });
  expect(staleSend.ok()).toBe(true);
  const { tx: staleOut } = (await staleSend.json()) as { tx: { id: string } };
  for (let i = 0; i < 3; i++) {
    const tick = await page.request.post("/api/wallet/tick", { data: { txid: staleOut.id } });
    expect(tick.ok()).toBe(true);
  }
  const staleRestore = await page.request.post("/api/wallet/restore", {
    data: { words: staleWallet.wallet.seedWords },
  });
  expect(staleRestore.ok()).toBe(true);
  await page.getByRole("link", { name: /Continue Bitcoin|Bitcoin road/ }).click();
  await page.waitForURL("**/what-is/satoshi");

  // 2D-first: rail layout present, 3D stage absent.
  await page.waitForSelector(".drive-layout");
  expect(await page.locator(".journey-stage").count()).toBe(0);

  // Quick checks render from step one: wrong pick shows ✗, right pick shows ✓.
  const satoshiWrong = page.getByRole("radio", {
    name: "Satoshi Nakamoto, from an office in Tokyo",
  });
  await satoshiWrong.click();
  await expect(satoshiWrong).toContainText("✗");
  const satoshiRight = page.getByRole("radio", {
    name: "No company — it is an open network running since 2009",
  });
  await satoshiRight.click();
  await expect(satoshiRight).toContainText("✓");

  await commitAndContinue(page, "Show me how scarce it is", "what-is/scarce");
  await commitAndContinue(page, "How do new coins appear?", "what-is/block");
  await commitAndContinue(page, "Does that pay stay the same?", "what-is/halving");
  await commitAndContinue(page, "What is a satoshi?", "what-is/sats");
  await commitAndContinue(page, "Show me my balance", "what-is/cheques");

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
  await commitAndContinue(page, "That's my address", "get-paid/receipt");

  // receipt: the client's payment lands as a real wallet deposit.
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
  await expect(page.getByText(/· Landed/)).toBeVisible();
  const receiptChip = await page
    .getByRole("button", { name: "Copy receipt transaction id" })
    .innerText();
  expect(receiptChip, "could not read receipt txid from copy chip").toMatch(/([0-9a-f]{64})/);
  await landedBtn.click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/get-paid/explorer");
  // The deposit is real: a second confirmed incoming tx sits in the wallet
  // (the first is the pre-course freshness fixture).
  const wstate = await page.request.get("/api/wallet");
  expect(wstate.ok()).toBe(true);
  const { wallet } = (await wstate.json()) as {
    wallet: { history: { direction: string; status: string }[] };
  };
  expect(
    wallet.history.filter((t) => t.direction === "in" && t.status === "confirmed").length,
  ).toBeGreaterThanOrEqual(2);

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
  await expect(page.getByText(/· Landed/)).toBeVisible();
  await commitAndContinue(page, "It landed", "guard/key");
  // The test send is real: a second confirmed outgoing sits in the wallet
  // (the first is the pre-course freshness fixture).
  const wafter = await page.request.get("/api/wallet");
  expect(wafter.ok()).toBe(true);
  const { wallet: afterSend } = (await wafter.json()) as {
    wallet: { history: { direction: string; status: string }[] };
  };
  expect(
    afterSend.history.filter((t) => t.direction === "out" && t.status === "confirmed").length,
  ).toBeGreaterThanOrEqual(2);

  await page.getByRole("button", { name: "Share address" }).click();
  await page.getByRole("button", { name: "Share key" }).click();
  await commitAndContinue(page, "I've seen both", "guard/words");

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

  // One wallet: the words lesson stamps the wallet's backup marker.
  await expect
    .poll(
      async () => {
        const r = await page.request.get("/api/wallet");
        const j = (await r.json()) as { wallet?: { backupAt?: string | null } | null };
        return j.wallet?.backupAt ?? null;
      },
      { timeout: 10000 },
    )
    .not.toBeNull();

  await commitAndContinue(page, "Close the chat", "road-test/network");

  await page.getByRole("button", { name: "Switch to Bitcoin" }).click();
  await commitAndContinue(page, "Continue", "road-test/mismatch");

  // No cert on mismatch: pocket card shows, Continue leads to the stuck drill.
  await commitAndContinue(page, "Stop the send", "road-test/stuck");

  // stuck: the economy send stalls at 0, the wrong remedy scolds, the bump lands.
  await page.getByRole("button", { name: "Send with an economy fee" }).click();
  await expect(page.getByText(/0 · Stuck/)).toBeVisible();
  await page.getByRole("button", { name: "Wait it out" }).click();
  await expect(
    page.locator('[role="alert"]', { hasText: /nobody is in a hurry/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bump the fee" }).click();
  await page.getByRole("button", { name: "Bump to priority" }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find((b) => b.textContent === "It landed")
        ?.disabled,
    undefined,
    { polling: 100 },
  );
  await expect(page.getByText(/· Landed/)).toBeVisible();
  await commitAndContinue(page, "It landed", "prove-it/verify");
  // Both drill sends share the wallet: stuck pending, bump confirmed.
  const wstuck = await page.request.get("/api/wallet");
  expect(wstuck.ok()).toBe(true);
  const { wallet: stuckWallet } = (await wstuck.json()) as {
    wallet: { history: { direction: string; status: string; amount: number }[] };
  };
  expect(
    stuckWallet.history.filter((t) => t.direction === "out" && t.amount === 50000).length,
  ).toBeGreaterThanOrEqual(2);

  // verify: same three checks as the explorer lesson, new commit button.
  await expectLayoutContract(page, "prove-it/verify");
  // quick check renders on verify: wrong pick shows ✗, right pick shows ✓.
  const verifyWrong = page.getByRole("radio", {
    name: "The sender's phone number and a screenshot",
  });
  await verifyWrong.click();
  await expect(verifyWrong).toContainText("✗");
  const verifyRight = page.getByRole("radio", {
    name: "The transaction ID and a public explorer",
  });
  await verifyRight.click();
  await expect(verifyRight).toContainText("✓");
  await page.getByRole("radio", { name: "Yes" }).check();
  await page.fill("#explorer-confirms", "900000");
  await page.fill("#explorer-fee", "4191");
  await page.getByRole("button", { name: "I verified the payment" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/prove-it/finality");

  // finality: coffee 0, laptop 3, house 6.
  await expectLayoutContract(page, "prove-it/finality");
  // quick check: wrong pick shows ✗, right pick shows ✓ on the option.
  const wrongOpt = page.getByRole("radio", {
    name: "The coffee — small payments reverse more easily",
  });
  await wrongOpt.click();
  await expect(wrongOpt).toContainText("✗");
  const rightOpt = page.getByRole("radio", {
    name: "The house deposit — higher amount, higher reversal cost",
  });
  await rightOpt.click();
  await expect(rightOpt).toContainText("✓");
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

  // explain: a valid CFO answer, then on to the final exam.
  await expectLayoutContract(page, "prove-it/explain");
  await page.fill(
    "#explain-text",
    "Bitcoin settles payments with finality in about ten minutes. Supply is scarce with a fixed supply capped at 21 million coins. We hold the keys in multi-sig custody with a named custodian.",
  );
  await page.getByRole("button", { name: "Make my case" }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/prove-it/exam");

  // exam freshness: the pre-exam wallet counts for setup only. Actions
  // must be redone inside the attempt; submit is rejected until then.
  await expectLayoutContract(page, "prove-it/exam");
  await expect(page.getByText("Only work done after opening this exam counts")).toBeVisible();
  await expect(page.getByText("Wallet ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Receive from faucet" })).toBeVisible();
  await page.getByRole("button", { name: "Submit my exam" }).click();
  await expect(page.getByText("Receive from the faucet first")).toBeVisible();
  // Reset clears the stale wallet; the original in-exam flow follows.
  const reset = await page.request.post("/api/wallet/reset", {
    data: { confirm: "RESET" },
  });
  expect(reset.ok()).toBe(true);
  await page.reload();
  // exam, task 1: set up the wallet in the in-course modal (no navigation).
  await expectLayoutContract(page, "prove-it/exam");
  const modal = page.getByRole("dialog", { name: "Practice wallet" });
  await page.getByRole("button", { name: "Create your wallet", exact: true }).click();
  await expect(modal).toBeVisible();
  await expect(page).toHaveURL(/\/prove-it\/exam/);
  await modal.getByRole("button", { name: "Create your wallet" }).click();
  await expect(modal.getByRole("heading", { name: "Your 12 words" })).toBeVisible();
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

  // Setup done — the exam re-syncs on modal close, no manual refresh.
  await expect(page.getByText("Wallet ready")).toBeVisible();

  // task 2: receive from the faucet, polled to confirmed by the scene.
  await expect(page.getByText("A faucet is a free-coins tap")).toBeVisible();
  await page.getByRole("button", { name: "Receive from faucet" }).click();
  await expect(page.getByText(/sats confirmed/)).toBeVisible({ timeout: 60000 });

  // task 3: send 10,000 sats to a valid address.
  await page.fill("#exam-to", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  await page.fill("#exam-sats", "10000");
  await page.getByRole("button", { name: "Send (Standard fee)" }).click();
  await expect(page.getByText("Spend proven.")).toBeVisible({ timeout: 60000 });

  // task 4: restore from the same 12 words (in the modal).
  await page.getByRole("button", { name: "Open wallet settings" }).click();
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Settings" }).click();
  await modal.getByRole("menuitem", { name: "Restore a wallet" }).click();
  const restoreDialog = modal.getByRole("dialog", { name: "Restore a wallet" });
  await expect(restoreDialog).toBeVisible();
  await restoreDialog.getByRole("button", { name: "Continue" }).click();
  for (let i = 0; i < 12; i++) {
    await modal.getByLabel(`Word ${i + 1}`, { exact: true }).fill(words[i] ?? "");
  }
  await modal.getByRole("button", { name: "Check words" }).click();
  await expect(modal.getByText("Same wallet. Same address. Same balance.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(restoreDialog).toBeHidden();
  await expect(modal).toBeVisible();

  // task 5: read back the first 8 txid chars from the deposit details.
  await modal
    .getByRole("button", { name: /^Received .* Show details\.$/ })
    .click();
  const dialog = modal.getByRole("dialog", { name: "Transaction details" });
  await expect(dialog).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Copy transaction ID" }).click();
  const fullTxid = await page.evaluate(() => navigator.clipboard.readText());
  expect(fullTxid).toMatch(/^[0-9a-f]{64}$/i);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await modal.getByRole("button", { name: "Close wallet" }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText("Wallet ready")).toBeVisible();
  await expect(page.getByText(/Restored /)).toBeVisible();
  await page.fill("#exam-claim", fullTxid.slice(0, 8));

  // submit → the certificate issues here.
  await page.getByRole("button", { name: "Submit my exam" }).click();
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

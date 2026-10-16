// Practice wallet sandbox: pure core (formatting, validation, transitions).
// Run with: node --test tests/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/wallet.test.mjs"));
const wallet = jiti(join(root, "src/lib/wallet.ts"));
const samples = jiti(join(root, "src/lib/practice-samples.ts"));

const WORDS = [
  "abandon", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse",
];
const ADDR = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";

function freshWallet() {
  return wallet.createWalletState({ seedWords: WORDS, address: ADDR });
}

describe("wallet formatting", () => {
  it("formats sats as grouped BTC without float error", () => {
    assert.equal(wallet.satsToBtc(500000), "0.00500000");
    assert.equal(wallet.satsToBtc(0), "0.00000000");
    assert.equal(wallet.satsToBtc(100000000), "1.00000000");
    assert.equal(
      wallet.formatBtcGrouped(500000).replace(/[\s ]/g, " "),
      "0.005 000 00",
    );
  });

  it("parses BTC decimals to exact sats", () => {
    assert.equal(wallet.parseBtcToSats("0.001"), 100000);
    assert.equal(wallet.parseBtcToSats("1"), 100000000);
    assert.equal(wallet.parseBtcToSats("0.00000001"), 1);
    assert.equal(wallet.parseBtcToSats("0"), null);
    assert.equal(wallet.parseBtcToSats("abc"), null);
    assert.equal(wallet.parseBtcToSats("0.000000001"), null);
    assert.equal(wallet.parseBtcToSats("-1"), null);
  });

  it("truncates addresses middle-first", () => {
    assert.equal(wallet.truncateMiddle(ADDR), "bc1qw5…v8f3t4");
    assert.equal(wallet.truncateMiddle("short"), "short");
  });
});

describe("wallet validation", () => {
  it("accepts bc1q addresses, rejects the rest", () => {
    assert.equal(wallet.isValidBtcAddress(ADDR), true);
    assert.equal(wallet.isValidBtcAddress("  " + ADDR + "  "), true);
    assert.equal(wallet.isValidBtcAddress("0x1234567890abcdef1234567890abcdef12345678"), false);
    assert.equal(wallet.isValidBtcAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"), false);
    assert.equal(wallet.isValidBtcAddress("bc1qshort"), false);
    assert.equal(wallet.isValidBtcAddress("not an address"), false);
  });

  it("prices fee tiers off 140 vbytes", () => {
    assert.equal(wallet.feeSatsForTier("economy"), 140);
    assert.equal(wallet.feeSatsForTier("standard"), 700);
    assert.equal(wallet.feeSatsForTier("priority"), 2100);
  });
});

describe("wallet setup", () => {
  it("creates an empty wallet with 12 words and the practice address", () => {
    const seed = samples.derivePracticeSeed("w@example.com", "CD-DRIVE-2026");
    const practice = samples.practiceFor(seed);
    const w = wallet.createWalletState({ seedWords: practice.words, address: practice.address });
    assert.equal(w.exists, true);
    assert.equal(w.seedWords.length, 12);
    assert.equal(w.address, practice.address);
    assert.equal(w.balance, 0);
    assert.deepEqual(w.history, []);
    assert.equal(w.backupAt, null);
  });

  it("derives deterministic counterparties and txids per index", () => {
    const seed = samples.derivePracticeSeed("w@example.com", "CD-DRIVE-2026");
    const a0 = samples.walletCounterparty(seed, 0);
    assert.ok(wallet.isValidBtcAddress(a0));
    assert.equal(a0, samples.walletCounterparty(seed, 0));
    assert.notEqual(a0, samples.walletCounterparty(seed, 1));
    const t0 = samples.walletTxid(seed, 0);
    assert.match(t0, /^[0-9a-f]{64}$/);
    assert.equal(t0, samples.walletTxid(seed, 0));
    assert.notEqual(t0, samples.walletTxid(seed, 1));
  });
});

describe("wallet send", () => {
  it("blocks insufficient balance with the fee-aware message", () => {
    const w = { ...freshWallet(), balance: 100000 };
    assert.equal(
      wallet.validateSend(w, { to: ADDR, amountSats: 100000, feeTier: "standard" }),
      "Not enough. Don't forget the fee.",
    );
    assert.equal(
      wallet.validateSend(w, { to: "0xabc", amountSats: 1000, feeTier: "standard" }),
      "That doesn't look like a Bitcoin address. It should start with bc1.",
    );
    assert.equal(
      wallet.validateSend(w, { to: ADDR, amountSats: 99000, feeTier: "standard" }),
      null,
    );
  });

  it("debits amount + fee and prepends a pending tx", () => {
    const w = { ...freshWallet(), balance: 500000 };
    const next = wallet.applySend(w, {
      txid: "f".repeat(64),
      to: ADDR,
      amountSats: 100000,
      feeTier: "standard",
      timestamp: "2026-10-15T00:00:00.000Z",
      memo: "test",
    });
    assert.equal(next.balance, 500000 - 100000 - 700);
    assert.equal(next.history.length, 1);
    assert.equal(next.history[0].direction, "out");
    assert.equal(next.history[0].status, "pending");
    assert.equal(next.history[0].fee, 700);
    assert.equal(next.history[0].memo, "test");
  });

  it("credits deposits only when confirmations reach the threshold", () => {
    let w = freshWallet();
    w = wallet.applyDeposit(w, {
      txid: "a".repeat(64),
      from: ADDR,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    assert.equal(w.balance, 0);
    let r = wallet.advanceTx(w, "a".repeat(64));
    assert.equal(r.confirmed, false);
    assert.equal(r.wallet.history[0].confirmations, 1);
    r = wallet.advanceTx(r.wallet, "a".repeat(64));
    r = wallet.advanceTx(r.wallet, "a".repeat(64));
    assert.equal(r.confirmed, true);
    assert.equal(r.wallet.history[0].status, "confirmed");
    assert.equal(r.wallet.balance, 500000);
    // Ticking a confirmed tx is a no-op.
    const again = wallet.advanceTx(r.wallet, "a".repeat(64));
    assert.equal(again.confirmed, false);
    assert.equal(again.wallet.balance, 500000);
  });

  it("records an incoming deposit as pending 0/3", () => {
    const w = wallet.applyDeposit(freshWallet(), {
      txid: "b".repeat(64),
      from: ADDR,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    assert.equal(w.history.length, 1);
    assert.equal(w.history[0].direction, "in");
    assert.equal(w.history[0].status, "pending");
    assert.equal(w.history[0].confirmations, 0);
    assert.equal(w.history[0].amount, 500000);
  });
});

describe("wallet setup positions", () => {
  it("asks for seed words 3, 7, and 11", () => {
    assert.deepEqual([...wallet.SEED_CONFIRM_POSITIONS], [3, 7, 11]);
  });
});

describe("wallet restore", () => {
  it("matches the saved seed case-insensitively, rejects the rest", () => {
    assert.equal(wallet.restoreMatches(WORDS, WORDS.map((w) => w.toUpperCase())), true);
    const wrong = [...WORDS];
    wrong[11] = "zoo";
    assert.equal(wallet.restoreMatches(WORDS, wrong), false);
    assert.equal(wallet.restoreMatches(WORDS, WORDS.slice(0, 11)), false);
  });
});

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

  it("accepts tb1q and bcrt1q alongside bc1q, rejects the rest", () => {
    const seed = samples.derivePracticeSeed("w@example.com", "CD-DRIVE-2026");
    assert.equal(wallet.isValidBtcAddress(samples.addressForSeed(seed, "bc")), true);
    assert.equal(wallet.isValidBtcAddress(samples.addressForSeed(seed, "tb")), true);
    assert.equal(wallet.isValidBtcAddress(samples.addressForSeed(seed, "bcrt")), true);
    assert.equal(wallet.isValidBtcAddress("0xabc"), false);
    assert.equal(wallet.isValidBtcAddress("bc1qshort"), false);
  });

  it("trims BTC decimals for review rows", () => {
    assert.equal(wallet.formatBtcTrim(100000), "0.001");
    assert.equal(wallet.formatBtcTrim(700), "0.000007");
    assert.equal(wallet.formatBtcTrim(100700), "0.001007");
    assert.equal(wallet.formatBtcTrim(100000000), "1");
    assert.equal(wallet.formatBtcTrim(0), "0");
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

  it("fee quotes match only an unchanged live price", () => {
    assert.equal(wallet.feeQuoteMatches(700, 700), true);
    assert.equal(wallet.feeQuoteMatches(700, 750), false);
    assert.equal(wallet.feeQuoteMatches(undefined, 750), true);
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
      "That doesn't look like a Bitcoin address. It should start with bc1q, tb1q, or bcrt1q.",
    );
    assert.equal(
      wallet.validateSend(w, { to: ADDR, amountSats: 99000, feeTier: "standard" }),
      null,
    );
    assert.equal(
      wallet.validateSend(w, { to: ADDR, amountSats: 0, feeTier: "standard" }),
      "Enter an amount.",
    );
  });

  it("maps live rates onto tiers, floors at 1 sat/vB", () => {
    const tiers = wallet.feeTiersFromRates({ fastest: 9.6, halfHour: 4.2, economy: 0.3 });
    assert.deepEqual(
      tiers.map((t) => [t.id, t.satPerVb]),
      [
        ["economy", 1],
        ["standard", 4],
        ["priority", 10],
      ],
    );
    assert.equal(tiers[1].label, "Standard");
  });

  it("applies polled confirmations and credits once at the threshold", () => {
    let w = wallet.applyDeposit(freshWallet(), {
      txid: "c".repeat(64),
      from: ADDR,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    let r = wallet.applyTxStatus(w, "c".repeat(64), { confirmations: 1 });
    assert.equal(r.confirmed, false);
    assert.equal(r.wallet.balance, 0);
    r = wallet.applyTxStatus(r.wallet, "c".repeat(64), { confirmations: 3 });
    assert.equal(r.confirmed, true);
    assert.equal(r.wallet.balance, 500000);
    const again = wallet.applyTxStatus(r.wallet, "c".repeat(64), { confirmations: 9 });
    assert.equal(again.confirmed, false);
    assert.equal(again.wallet.balance, 500000);
    const unknown = wallet.applyTxStatus(w, "d".repeat(64), { confirmations: 6 });
    assert.equal(unknown.confirmed, false);
    assert.equal(unknown.wallet.balance, 0);
  });

  it("stores the polled block height and keeps it across polls", () => {
    const w = wallet.applyDeposit(freshWallet(), {
      txid: "c".repeat(64),
      from: ADDR,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    assert.equal(w.history[0].blockHeight, undefined);
    const first = wallet.applyTxStatus(w, "c".repeat(64), {
      confirmations: 1,
      blockHeight: 108,
    });
    assert.equal(first.wallet.history[0].blockHeight, 108);
    // A later poll without a height (or a null one) must not wipe it.
    const second = wallet.applyTxStatus(first.wallet, "c".repeat(64), {
      confirmations: 2,
    });
    assert.equal(second.wallet.history[0].blockHeight, 108);
    const third = wallet.applyTxStatus(second.wallet, "c".repeat(64), {
      confirmations: 3,
      blockHeight: null,
    });
    assert.equal(third.confirmed, true);
    assert.equal(third.wallet.history[0].blockHeight, 108);
  });

  it("maps txids to explorer URLs per network, never for simulated", () => {
    const txid = "a".repeat(64);
    assert.equal(wallet.explorerTxUrl("simulated", txid), null);
    assert.equal(
      wallet.explorerTxUrl("signet", txid),
      `https://mempool.space/signet/tx/${txid}`,
    );
    assert.equal(
      wallet.explorerTxUrl("regtest", txid),
      `http://localhost:5000/tx/${txid}`,
    );
    assert.equal(
      wallet.explorerTxUrl("regtest", txid, "https://esplora.example.com/"),
      `https://esplora.example.com/tx/${txid}`,
    );
    assert.equal(wallet.explorerTxUrl("signet", "not-a-txid"), null);
    assert.equal(wallet.explorerTxUrl("regtest", ""), null);
  });

  it("marks sends off-chain and honors the deposit flag", () => {
    const w = { ...freshWallet(), balance: 500000 };
    const sent = wallet.applySend(w, {
      txid: "e".repeat(64),
      to: ADDR,
      amountSats: 100000,
      feeTier: "economy",
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    assert.equal(sent.history[0].onChain, false);
    assert.equal(sent.history[0].feeTier, "economy");
    const invented = wallet.applyDeposit(freshWallet(), {
      txid: "c".repeat(64),
      from: ADDR,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    assert.equal(invented.history[0].onChain, false);
    const funded = wallet.applyDeposit(freshWallet(), {
      txid: "d".repeat(64),
      from: wallet.REGTEST_FAUCET_LABEL,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
      onChain: true,
    });
    assert.equal(funded.history[0].onChain, true);
  });

  it("isOnChainTx trusts the flag, backfills pre-flag faucet rows", () => {
    assert.equal(wallet.isOnChainTx({ onChain: true, counterparty: "x" }), true);
    assert.equal(wallet.isOnChainTx({ onChain: false, counterparty: wallet.REGTEST_FAUCET_LABEL }), false);
    assert.equal(
      wallet.isOnChainTx({ counterparty: wallet.REGTEST_FAUCET_LABEL }),
      true,
      "legacy real fund",
    );
    assert.equal(wallet.isOnChainTx({ counterparty: ADDR }), false, "legacy invented tx");
  });

  it("examReadiness derives the four store tasks plus the read-back target", () => {
    assert.deepEqual(wallet.examReadiness(null, "regtest"), {
      setup: false,
      receive: false,
      send: false,
      restore: false,
      examTxid: null,
    });
    const bare = freshWallet();
    assert.equal(wallet.examReadiness(bare, "simulated").setup, true);
    assert.equal(wallet.examReadiness(bare, "simulated").receive, false);
    const funded = wallet.applyDeposit(bare, {
      txid: "c".repeat(64),
      from: wallet.REGTEST_FAUCET_LABEL,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
      onChain: true,
    });
    const confirmed = wallet.applyTxStatus(funded, "c".repeat(64), { confirmations: 3 });
    const r = wallet.examReadiness(
      { ...confirmed.wallet, restoredAt: "2026-10-15T00:00:00.000Z" },
      "regtest",
    );
    assert.equal(r.receive, true);
    assert.equal(r.restore, true);
    assert.equal(r.examTxid, "c".repeat(64));
    // Regtest demands a real fund: an invented confirmed deposit fails there…
    const invented = wallet.applyTxStatus(
      wallet.applyDeposit(bare, {
        txid: "d".repeat(64),
        from: ADDR,
        amountSats: 500000,
        timestamp: "2026-10-15T00:00:00.000Z",
      }),
      "d".repeat(64),
      { confirmations: 3 },
    );
    assert.equal(wallet.examReadiness(invented.wallet, "regtest").receive, false);
    // …but counts in simulated mode.
    assert.equal(wallet.examReadiness(invented.wallet, "simulated").receive, true);
    // A confirmed send flips the spend task in every mode.
    const w = { ...freshWallet(), balance: 500000 };
    const sent = wallet.applySend(w, {
      txid: "e".repeat(64),
      to: ADDR,
      amountSats: 100000,
      feeTier: "economy",
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    const spent = wallet.advanceTx(
      wallet.advanceTx(wallet.advanceTx(sent, "e".repeat(64)).wallet, "e".repeat(64)).wallet,
      "e".repeat(64),
    );
    assert.equal(spent.wallet.history[0].status, "confirmed");
    assert.equal(wallet.examReadiness(spent.wallet, "regtest").send, true);
  });

  it("examReadiness ignores pre-attempt evidence when since is set", () => {
    const old = "2026-10-10T00:00:00.000Z";
    const mark = "2026-10-15T00:00:00.000Z";
    const bare = freshWallet();
    const dep = wallet.applyTxStatus(
      wallet.applyDeposit(bare, {
        txid: "c".repeat(64),
        from: ADDR,
        amountSats: 500000,
        timestamp: old,
      }),
      "c".repeat(64),
      { confirmations: 3 },
    ).wallet;
    const w = { ...dep, restoredAt: old, balance: 500000 };
    const sent = wallet.applySend(w, {
      txid: "e".repeat(64),
      to: ADDR,
      amountSats: 100000,
      feeTier: "economy",
      timestamp: old,
    });
    let cur = sent;
    for (let i = 0; i < 3; i++) cur = wallet.advanceTx(cur, "e".repeat(64)).wallet;
    // Without a marker everything counts (back-compat).
    const open = wallet.examReadiness(cur, "simulated");
    assert.equal(open.receive, true);
    assert.equal(open.send, true);
    assert.equal(open.restore, true);
    // With a marker, stale evidence drops but setup (a precondition) holds.
    const stale = wallet.examReadiness(cur, "simulated", mark);
    assert.equal(stale.setup, true);
    assert.equal(stale.receive, false);
    assert.equal(stale.send, false);
    assert.equal(stale.restore, false);
    assert.equal(stale.examTxid, null);
  });

  it("examReadiness picks the fresh deposit and honors the boundary", () => {
    const mark = "2026-10-15T00:00:00.000Z";
    const bare = freshWallet();
    const old = wallet.applyTxStatus(
      wallet.applyDeposit(bare, {
        txid: "a".repeat(64),
        from: ADDR,
        amountSats: 500000,
        timestamp: "2026-10-10T00:00:00.000Z",
      }),
      "a".repeat(64),
      { confirmations: 3 },
    ).wallet;
    const both = wallet.applyTxStatus(
      wallet.applyDeposit(old, {
        txid: "b".repeat(64),
        from: ADDR,
        amountSats: 500000,
        timestamp: mark,
      }),
      "b".repeat(64),
      { confirmations: 3 },
    ).wallet;
    const r = wallet.examReadiness(both, "simulated", mark);
    assert.equal(r.receive, true);
    assert.equal(r.examTxid, "b".repeat(64));
  });

  it("shouldPollChain polls only regtest txs that exist on the chain", () => {
    const on = { onChain: true, counterparty: wallet.REGTEST_FAUCET_LABEL };
    const off = { onChain: false, counterparty: ADDR };
    const legacyFund = { counterparty: wallet.REGTEST_FAUCET_LABEL };
    assert.equal(wallet.shouldPollChain("regtest", on), true);
    assert.equal(wallet.shouldPollChain("regtest", off), false);
    assert.equal(wallet.shouldPollChain("regtest", legacyFund), true);
    assert.equal(wallet.shouldPollChain("simulated", on), false);
    assert.equal(wallet.shouldPollChain("signet", on), false);
  });

  it("prices fee tiers at 140 / 700 / 2100 sats", () => {
    assert.equal(wallet.feeSatsForTier("economy"), 140);
    assert.equal(wallet.feeSatsForTier("standard"), 700);
    assert.equal(wallet.feeSatsForTier("priority"), 2100);
    const w = { ...freshWallet(), balance: 500000 };
    const eco = wallet.applySend(w, {
      txid: "e".repeat(64),
      to: ADDR,
      amountSats: 100000,
      feeTier: "economy",
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    assert.equal(eco.history[0].fee, 140);
    assert.equal(eco.balance, 500000 - 100000 - 140);
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

  it("spreads a pasted phrase across slots, clamps at 12", () => {
    const empty = Array(12).fill("");
    const full = wallet.distributeRestoreWords(empty, 0, WORDS.join(" "));
    assert.deepEqual(full, WORDS);
    const single = wallet.distributeRestoreWords(empty, 3, "apple");
    assert.equal(single[3], "apple");
    assert.equal(single[4], "");
    const tail = wallet.distributeRestoreWords(empty, 10, "one two three four");
    assert.deepEqual(tail.slice(10), ["one", "two"]);
  });

  it("formats backup age as relative time", () => {
    const now = Date.parse("2026-10-16T12:00:00.000Z");
    assert.equal(wallet.formatRelativeTime("2026-10-16T11:59:30.000Z", now), "just now");
    assert.equal(wallet.formatRelativeTime("2026-10-16T11:59:00.000Z", now), "1 minute ago");
    assert.equal(wallet.formatRelativeTime("2026-10-16T11:30:00.000Z", now), "30 minutes ago");
    assert.equal(wallet.formatRelativeTime("2026-10-16T10:00:00.000Z", now), "2 hours ago");
    assert.equal(wallet.formatRelativeTime("2026-10-14T12:00:00.000Z", now), "2 days ago");
  });
});

// Final exam grading (prove-it/exam): server-side task verification.
// Simulated paths run against the store only; regtest paths mock fetch
// at the infra boundary. Run with: node --test tests/
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/exam.test.mjs"));
const exam = jiti(join(root, "src/lib/exam.ts"));
const wallet = jiti(join(root, "src/lib/wallet.ts"));
const bitcoin = jiti(join(root, "src/lib/bitcoin/index.ts"));

const WORDS = [
  "abandon", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse",
];
const ADDR = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const TX = "c".repeat(64);

function freshWallet() {
  return wallet.createWalletState({ seedWords: WORDS, address: ADDR });
}

function studentWith(w, examStartedAt = "2026-10-14T00:00:00.000Z") {
  return { id: "st_exam", email: "exam@test.local", wallet: w, examStartedAt };
}

function fullyWorkedWallet() {
  let w = confirmedDeposit(freshWallet());
  w = confirmedSend(w);
  return { ...w, restoredAt: "2026-10-15T00:00:00.000Z" };
}

function confirmedDeposit(w, { txid = TX, onChain = false, from = ADDR } = {}) {
  const dep = wallet.applyDeposit(w, {
    txid,
    from,
    amountSats: 500000,
    timestamp: "2026-10-15T00:00:00.000Z",
    ...(onChain ? { onChain: true } : {}),
  });
  return wallet.applyTxStatus(dep, txid, { confirmations: 3 }).wallet;
}

function confirmedSend(w) {
  const funded = { ...w, balance: 500000 };
  const sent = wallet.applySend(funded, {
    txid: "e".repeat(64),
    to: ADDR,
    amountSats: 100000,
    feeTier: "economy",
    timestamp: "2026-10-15T00:00:00.000Z",
  });
  let cur = sent;
  for (let i = 0; i < 3; i++) cur = wallet.advanceTx(cur, "e".repeat(64)).wallet;
  return cur;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const realFetch = global.fetch;

describe("verifyWalletExam", () => {
  beforeEach(() => {
    bitcoin.resetBitcoinProvider();
    delete process.env.BITCOIN_MODE;
    delete process.env.INFRA_BASE_URL;
    delete process.env.INFRA_SHARED_SECRET;
    global.fetch = realFetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    bitcoin.resetBitcoinProvider();
    delete process.env.BITCOIN_MODE;
    delete process.env.INFRA_BASE_URL;
    delete process.env.INFRA_SHARED_SECRET;
  });

  it("walks the task ladder in order in simulated mode", async () => {
    await assert.rejects(exam.verifyWalletExam(studentWith(null), {}), /practice wallet first/);
    const bare = freshWallet();
    await assert.rejects(exam.verifyWalletExam(studentWith(bare), {}), /Receive/);
    const pending = wallet.applyDeposit(bare, {
      txid: TX,
      from: ADDR,
      amountSats: 500000,
      timestamp: "2026-10-15T00:00:00.000Z",
    });
    await assert.rejects(exam.verifyWalletExam(studentWith(pending), {}), /Receive/);
    const got = confirmedDeposit(bare);
    await assert.rejects(
      exam.verifyWalletExam(studentWith(got), {}),
      /Send a payment/,
    );
    const spent = confirmedSend(got);
    await assert.rejects(exam.verifyWalletExam(studentWith(spent), {}), /Restore/);
    const restored = { ...spent, restoredAt: "2026-10-15T00:00:00.000Z" };
    await assert.rejects(
      exam.verifyWalletExam(studentWith(restored), {}),
      /Read the chain back/,
    );
    await assert.rejects(
      exam.verifyWalletExam(studentWith(restored), { examTxid: TX, examClaim: "deadbeef" }),
      /do not match/,
    );
    await exam.verifyWalletExam(studentWith(restored), {
      examTxid: TX,
      examClaim: TX.slice(0, 8),
    });
  });

  it("demands a real on-chain fund on regtest", async () => {
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "s3cret";
    const invented = confirmedDeposit(freshWallet());
    await assert.rejects(
      exam.verifyWalletExam(studentWith(invented), {}),
      /faucet/,
    );
  });

  it("checks the pasted height against the chain on regtest", async () => {
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "s3cret";
    let w = confirmedDeposit(freshWallet(), {
      onChain: true,
      from: wallet.REGTEST_FAUCET_LABEL,
    });
    w = confirmedSend(w);
    w = { ...w, restoredAt: "2026-10-15T00:00:00.000Z" };
    const student = studentWith(w);
    global.fetch = async (url, init) => {
      assert.match(String(url), new RegExp(`/api/tx/${TX}$`));
      assert.equal(init.headers.Authorization, "Bearer s3cret");
      return jsonResponse(200, { confirmed: true, confirmations: 5, blockHeight: 541 });
    };
    await exam.verifyWalletExam(student, { examTxid: TX, examClaim: "541" });
    await assert.rejects(
      exam.verifyWalletExam(student, { examTxid: TX, examClaim: "542" }),
      /does not match/,
    );
    await assert.rejects(
      exam.verifyWalletExam(student, { examTxid: TX, examClaim: "soon" }),
      /does not match/,
    );
  });

  it("fails closed without an attempt marker", async () => {
    const student = studentWith(fullyWorkedWallet(), null);
    await assert.rejects(
      exam.verifyWalletExam(student, { examTxid: TX, examClaim: TX.slice(0, 8) }),
      /Open the exam step first/,
    );
  });

  it("rejects sandbox work older than the attempt", async () => {
    // Every task done a day before the exam opened: receive fails first.
    const stale = studentWith(fullyWorkedWallet(), "2026-10-16T00:00:00.000Z");
    await assert.rejects(
      exam.verifyWalletExam(stale, { examTxid: TX, examClaim: TX.slice(0, 8) }),
      /Receive/,
    );
  });

  it("rejects a stale send and a stale restore independently", async () => {
    // Fresh deposit, stale send.
    let w = confirmedDeposit(freshWallet());
    w = wallet.applySend(
      { ...w, balance: 500000 },
      {
        txid: "e".repeat(64),
        to: ADDR,
        amountSats: 100000,
        feeTier: "economy",
        timestamp: "2026-10-10T00:00:00.000Z",
      },
    );
    for (let i = 0; i < 3; i++) w = wallet.advanceTx(w, "e".repeat(64)).wallet;
    w = { ...w, restoredAt: "2026-10-15T12:00:00.000Z" };
    await assert.rejects(
      exam.verifyWalletExam(
        studentWith(w, "2026-10-15T00:00:00.000Z"),
        { examTxid: TX, examClaim: TX.slice(0, 8) },
      ),
      /Send a payment/,
    );
    // Fresh deposit and send, stale restore.
    let w2 = confirmedDeposit(freshWallet());
    w2 = confirmedSend(w2);
    w2 = { ...w2, restoredAt: "2026-10-10T00:00:00.000Z" };
    await assert.rejects(
      exam.verifyWalletExam(
        studentWith(w2, "2026-10-15T00:00:00.000Z"),
        { examTxid: TX, examClaim: TX.slice(0, 8) },
      ),
      /Restore/,
    );
  });

  it("rejects reading back a pre-attempt deposit", async () => {
    // Old deposit + fresh deposit; citing the old one fails the read-back.
    let w = confirmedDeposit(freshWallet(), { txid: "a".repeat(64) });
    w = { ...w, history: w.history.map((t) => ({ ...t, timestamp: "2026-10-10T00:00:00.000Z" })) };
    const fresh = wallet.applyDeposit(w, {
      txid: TX,
      from: ADDR,
      amountSats: 500000,
      timestamp: "2026-10-15T12:00:00.000Z",
    });
    const done = wallet.applyTxStatus(fresh, TX, { confirmations: 3 }).wallet;
    let cur = confirmedSend(done);
    cur = { ...cur, restoredAt: "2026-10-15T12:00:00.000Z" };
    const student = studentWith(cur, "2026-10-15T00:00:00.000Z");
    await assert.rejects(
      exam.verifyWalletExam(student, {
        examTxid: "a".repeat(64),
        examClaim: "a".repeat(8),
      }),
      /not an older one/,
    );
    await exam.verifyWalletExam(student, { examTxid: TX, examClaim: TX.slice(0, 8) });
  });

  it("counts evidence stamped exactly at the attempt start", async () => {
    const student = studentWith(fullyWorkedWallet(), "2026-10-15T00:00:00.000Z");
    await exam.verifyWalletExam(student, { examTxid: TX, examClaim: TX.slice(0, 8) });
  });

  it("fails closed when the txid is not on the chain", async () => {
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "s3cret";
    let w = confirmedDeposit(freshWallet(), {
      onChain: true,
      from: wallet.REGTEST_FAUCET_LABEL,
    });
    w = confirmedSend(w);
    w = { ...w, restoredAt: "2026-10-15T00:00:00.000Z" };
    global.fetch = async () => jsonResponse(404, { error: "tx not found" });
    await assert.rejects(
      exam.verifyWalletExam(studentWith(w), { examTxid: TX, examClaim: "541" }),
      /not on the chain/,
    );
  });
});

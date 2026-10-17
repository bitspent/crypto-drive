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

function studentWith(w) {
  return { id: "st_exam", email: "exam@test.local", wallet: w };
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

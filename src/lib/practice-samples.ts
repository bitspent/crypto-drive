import { createHash, createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { PIZZA_EXPLORER } from "./explorer-lesson";
import {
  CUSTODY_MODELS,
  FEE_STRATEGY,
  POLICY_THRESHOLDS,
  gradeExplainText,
  type PracticeSet,
  type StepAnswer,
} from "./practice-types";

export type { PracticeSet, StepAnswer } from "@/lib/practice-types";
export { PIZZA_EXPLORER } from "./explorer-lesson";

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

let bip39Cache: string[] | null = null;

function bip39Words(): string[] {
  if (bip39Cache) return bip39Cache;
  const raw = readFileSync(join(process.cwd(), "src/lib/data/bip39-english.txt"), "utf8");
  bip39Cache = raw
    .split("\n")
    .map((w) => w.trim())
    .filter(Boolean);
  if (bip39Cache.length !== 2048) {
    throw new Error("BIP39 English list must have 2048 words.");
  }
  return bip39Cache;
}

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const high = [...hrp].map((c) => c.charCodeAt(0) >> 5);
  const low = [...hrp].map((c) => c.charCodeAt(0) & 31);
  return [...high, 0, ...low];
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const mod = polymod(values) ^ 1;
  return [0, 1, 2, 3, 4, 5].map((i) => (mod >> (5 * (5 - i))) & 31);
}

function bech32Encode(hrp: string, data: number[]): string {
  const combined = [...data, ...createChecksum(hrp, data)];
  return `${hrp}1${combined.map((d) => CHARSET[d]).join("")}`;
}

/** Witness v0 P2WPKH from 20 program bytes → bc1q… */
function p2wpkhAddress(program20: Buffer): string {
  if (program20.length !== 20) throw new Error("P2WPKH needs 20 bytes.");
  const data = [0];
  let acc = 0;
  let bits = 0;
  for (const byte of program20) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      data.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) data.push((acc << (5 - bits)) & 31);
  return bech32Encode("bc", data);
}

function seedBytes(seed: string, label: string, length: number): Buffer {
  return createHmac("sha256", seed).update(label).digest().subarray(0, length);
}

function hexTxid(seed: string): string {
  return createHash("sha256").update(`txid:${seed}`).digest("hex");
}

/** Deterministic simulated counterparty address for the wallet's nth tx. */
export function walletCounterparty(seed: string, n: number): string {
  return p2wpkhAddress(seedBytes(seed, `wallet-peer:${n}`, 20));
}

/** Deterministic simulated txid for the wallet's nth tx. */
export function walletTxid(seed: string, n: number): string {
  return hexTxid(`${seed}:wallet-tx:${n}`);
}

function pickWords(seed: string): string[] {
  const list = bip39Words();
  const used = new Set<number>();
  const words: string[] = [];
  let round = 0;
  while (words.length < 12) {
    const buf = seedBytes(seed, `words:${round}`, 32);
    for (let i = 0; i + 1 < buf.length && words.length < 12; i += 2) {
      const idx = ((buf[i] << 8) | buf[i + 1]) % 2048;
      if (used.has(idx)) continue;
      used.add(idx);
      words.push(list[idx]);
    }
    round += 1;
  }
  return words;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function formatBtc(n: number): string {
  return round4(n).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Fail fast when booting production without a signing secret. Called at module
 * load by this module and by the store, so `next build` / `next start` refuse
 * to run undeployable.
 */
export function assertCertHashSecret(): void {
  if (process.env.NODE_ENV === "production" && !process.env.CERT_HASH_SECRET) {
    throw new Error("CERT_HASH_SECRET must be set in production. See .env.example.");
  }
}

assertCertHashSecret();

let warnedCertFallback = false;

/** Signing secret for practice seeds and certificate hashes. */
export function certHashSecret(): string {
  const secret = process.env.CERT_HASH_SECRET;
  if (secret) return secret;
  if (!warnedCertFallback) {
    warnedCertFallback = true;
    console.warn(
      "[crypto-drive] CERT_HASH_SECRET not set. Using dev fallback. Do not deploy like this.",
    );
  }
  return "crypto-drive-dev-secret";
}

/**
 * Stable practice seed from email + license. Same pair always yields the same
 * drills. The raw license is not stored — only this hash.
 */
export function derivePracticeSeed(email: string, license: string): string {
  const secret = certHashSecret();
  return createHmac("sha256", secret)
    .update(`${email.trim().toLowerCase()}|${license.trim().toUpperCase()}`)
    .digest("hex")
    .slice(0, 32);
}

/** Build this learner's practice values from their practice seed. */
export function practiceFor(seed: string): PracticeSet {
  if (!seed || seed.length < 16) {
    throw new Error("Practice seed missing. Unlock again with your license.");
  }

  const address = p2wpkhAddress(seedBytes(seed, "recv", 20));
  const dest = p2wpkhAddress(seedBytes(seed, "dest", 20));
  let swapped = dest;
  for (let n = 1; n < 64; n++) {
    const candidate = p2wpkhAddress(seedBytes(seed, `swap:${n}`, 20));
    if (
      candidate.slice(0, 8) === dest.slice(0, 8) &&
      candidate.slice(-4) !== dest.slice(-4)
    ) {
      swapped = candidate;
      break;
    }
    if (
      candidate.slice(0, 4) === dest.slice(0, 4) &&
      candidate.slice(-4) !== dest.slice(-4)
    ) {
      swapped = candidate;
    }
  }
  if (swapped === dest || swapped.slice(-4) === dest.slice(-4)) {
    // Last resort: flip the program and keep a valid address with a new ending.
    const prog = Buffer.from(seedBytes(seed, "dest", 20));
    prog[19] = (prog[19] + 17) % 256;
    swapped = p2wpkhAddress(prog);
  }

  const balanceUnits = 80 + (seedBytes(seed, "bal", 1)[0] % 70); // 0.0080–0.0149
  const balance = round4(balanceUnits / 10000);
  const sendUnits = 10 + (seedBytes(seed, "send", 1)[0] % 20); // 0.0010–0.0029
  const send = round4(sendUnits / 10000);
  const slowFee = round4(0.0001 + (seedBytes(seed, "slow", 1)[0] % 9) / 100000);
  const fastFee = round4(balance); // never fits with the send

  const c1 = round4((12 + (seedBytes(seed, "c1", 1)[0] % 20)) / 10000);
  const c2 = round4((15 + (seedBytes(seed, "c2", 1)[0] % 25)) / 10000);
  const c3 = round4((18 + (seedBytes(seed, "c3", 1)[0] % 30)) / 10000);
  const chequesTotal = round4(c1 + c2 + c3);

  const changeFrom = round4(send + slowFee + 0.002 + (seedBytes(seed, "chg", 1)[0] % 20) / 10000);
  const changePay = send;
  const changeBack = round4(changeFrom - changePay - slowFee);

  return {
    address,
    dest,
    swapped,
    txid: hexTxid(seed),
    receivedBtc: formatBtc(balance),
    receivedLabel: `${formatBtc(balance)} BTC`,
    sendBtc: formatBtc(send),
    balance,
    slowFee,
    fastFee,
    words: pickWords(seed),
    recallPositions: [3, 6, 9],
    cheques: [c1, c2, c3],
    chequesTotal: formatBtc(chequesTotal),
    changeFrom,
    changePay,
    changeBack,
  };
}

export function gradeStepAnswer(
  stepId: string,
  actionType: string,
  practice: PracticeSet,
  answer: StepAnswer | undefined,
): string | null {
  if (actionType === "address-check") {
    const first = answer?.first4?.trim().toLowerCase() ?? "";
    const last = answer?.last4?.trim().toLowerCase() ?? "";
    if (first !== practice.address.slice(0, 4) || last !== practice.address.slice(-4)) {
      return "Match the first 4 and the last 4 on your wallet screen.";
    }
    return null;
  }

  if (actionType === "receipt") {
    if ((answer?.txid?.trim().toLowerCase() ?? "") !== practice.txid) {
      return "Paste the full receipt number from the client.";
    }
    return null;
  }

  if (actionType === "explorer-read") {
    if (answer?.explorerConfirmed !== "yes") {
      return "Open the explorer link. Is this transaction confirmed? Pick yes when status says confirmed.";
    }
    const confirms = Number(answer?.explorerConfirmations);
    if (!Number.isFinite(confirms) || confirms < PIZZA_EXPLORER.confirmationsMin) {
      return `Confirmations grow over time. Enter the number you see (at least ${PIZZA_EXPLORER.confirmationsMin.toLocaleString("en-US")}).`;
    }
    const fee = Number(answer?.explorerFeeRate);
    if (
      !Number.isFinite(fee) ||
      fee < PIZZA_EXPLORER.feeRateMin ||
      fee > PIZZA_EXPLORER.feeRateMax
    ) {
      return "Find the fee rate in sat/vB on the explorer page (near the fee). Enter that number.";
    }
    return null;
  }

  if (actionType === "intro" && stepId === "btc-intro-cheques") {
    const got = answer?.chequesTotal?.trim() ?? "";
    if (got !== practice.chequesTotal && Number(got) !== Number(practice.chequesTotal)) {
      return "Add the three cheques. That total is your balance.";
    }
    return null;
  }

  if (actionType === "fee-room") {
    if (answer?.pace !== "slow") {
      return "Leave room for the toll — pick the slower pace.";
    }
    return null;
  }

  if (actionType === "seed-card") {
    const want = practice.recallPositions.map((n) => practice.words[n - 1]);
    const got = (answer?.recallWords ?? []).map((w) => w.trim().toLowerCase());
    if (got.length !== want.length || got.some((w, i) => w !== want[i])) {
      return "Recall the words in the order they sat on the card.";
    }
    return null;
  }

  if (actionType === "policy-pick") {
    const coffee = Number(answer?.policyCoffee);
    const laptop = Number(answer?.policyLaptop);
    const house = Number(answer?.policyHouse);
    if (!Number.isInteger(coffee) || coffee !== POLICY_THRESHOLDS.coffee) {
      return "A $4 in-person coffee doesn't need confirmations. Zero is the professional call.";
    }
    if (
      !Number.isInteger(laptop) ||
      laptop < POLICY_THRESHOLDS.laptopMin ||
      laptop > POLICY_THRESHOLDS.laptopMax
    ) {
      return "A $1,800 shipped laptop to a new customer needs one to three confirmations.";
    }
    if (!Number.isInteger(house) || house < POLICY_THRESHOLDS.houseMin) {
      return "For a $200,000 irreversible payment, six confirmations is the floor. Try again.";
    }
    return null;
  }

  if (actionType === "model-compare") {
    const compared = answer?.comparedModels ?? [];
    if (CUSTODY_MODELS.some((m) => !compared.includes(m))) {
      return "Expand all four models first.";
    }
    if (answer?.modelPick !== "multi-sig") {
      return "Multi-sig is the only model where no single person can lose the funds alone.";
    }
    return null;
  }

  if (actionType === "fee-strategy") {
    if (
      answer?.feePayroll !== FEE_STRATEGY.payroll ||
      answer?.feeSupplier !== FEE_STRATEGY.supplier
    ) {
      return "The supplier deadline justifies the priority fee. The payroll batch can wait for economy.";
    }
    return null;
  }

  if (actionType === "seed-restore") {
    const got = (answer?.restoreWords ?? []).map((w) => w.trim().toLowerCase());
    if (got.length !== 12) {
      return "Enter all twelve words in order.";
    }
    const bad = got.findIndex((w, i) => w !== practice.words[i]);
    if (bad >= 0) {
      return `Word ${bad + 1} is wrong. Check your written card.`;
    }
    return null;
  }

  if (actionType === "free-write-rubric") {
    return gradeExplainText(answer?.explainText ?? "");
  }

  return null;
}

export {
  CUSTODY_MODELS,
  EXPLAIN_RUBRIC,
  FEE_STRATEGY,
  POLICY_THRESHOLDS,
  gradeExplainText,
} from "./practice-types";

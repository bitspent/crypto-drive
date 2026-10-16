/**
 * Practice wallet sandbox: pure core. No fs, no network — safe to import
 * from client components, API routes, and unit tests alike.
 *
 * All values are simulated and deterministic from the learner's practice
 * seed. The wallet address IS the get-paid/address (same seed, same wallet).
 */

export type TxDirection = "in" | "out";
export type TxStatus = "pending" | "confirmed";

export type TxRecord = {
  id: string;
  direction: TxDirection;
  /** Amount in sats (fee excluded; see `fee`). */
  amount: number;
  counterparty: string;
  status: TxStatus;
  confirmations: number;
  /** Fee in sats, outgoing only. */
  fee?: number;
  timestamp: string;
  memo?: string;
};

export type WalletState = {
  exists: boolean;
  seedWords: string[];
  address: string;
  /** Spendable balance in sats. */
  balance: number;
  /** Newest first. */
  history: TxRecord[];
  confirmedThreshold: number;
  /** ISO date of last completed backup, or null. */
  backupAt: string | null;
};

export const WALLET_CONFIRMED_THRESHOLD = 3;
/** Fixed simulated deposit per receive flow, in sats (0.005 BTC). */
export const WALLET_DEPOSIT_SATS = 500_000;
/** Assumed tx size for fee estimates. Static simulation, not a live read. */
export const WALLET_TX_VBYTES = 140;
/** Typed confirmation word that authorizes a wallet reset. */
export const WALLET_RESET_WORD = "RESET";

/** 1-based seed positions the setup/backup confirm prompts ask for. */
export const SEED_CONFIRM_POSITIONS = [3, 7, 11] as const;

export type FeeTierId = "economy" | "standard" | "priority";

export const FEE_TIERS: ReadonlyArray<{
  id: FeeTierId;
  label: string;
  satPerVb: number;
  etaLabel: string;
}> = [
  { id: "economy", label: "Economy", satPerVb: 1, etaLabel: "~60 min" },
  { id: "standard", label: "Standard", satPerVb: 5, etaLabel: "~30 min" },
  { id: "priority", label: "Priority", satPerVb: 15, etaLabel: "~10 min" },
];

export function feeSatsForTier(tier: FeeTierId): number {
  const found = FEE_TIERS.find((t) => t.id === tier);
  if (!found) throw new Error(`Unknown fee tier: ${tier}`);
  return found.satPerVb * WALLET_TX_VBYTES;
}

const SATS_PER_BTC = 100_000_000;

/** Exact sats → "0.00500000" (integer math, no floats). */
export function satsToBtc(sats: number): string {
  const whole = Math.trunc(sats / SATS_PER_BTC);
  const frac = String(Math.abs(sats) % SATS_PER_BTC).padStart(8, "0");
  return `${whole}.${frac}`;
}

/** "0.00500000" → "0.005 000 00" (thin-space groups 3-3-2). */
export function formatBtcGrouped(sats: number): string {
  const [whole, frac] = satsToBtc(sats).split(".") as [string, string];
  return `${whole}.${frac.slice(0, 3)} ${frac.slice(3, 6)} ${frac.slice(6, 8)}`;
}

/** Strict BTC decimal → sats, or null. "0.001" → 100000. No float math. */
export function parseBtcToSats(input: string): number | null {
  const raw = input.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const sats = Number(whole) * SATS_PER_BTC + Number(frac.padEnd(8, "0") || 0);
  if (!Number.isSafeInteger(sats) || sats <= 0) return null;
  return sats;
}

/** "bc1q..." → first 6 + "…" + last 6. Short strings pass through. */
export function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/** P2WPKH shape check: bc1q + bech32 chars. No checksum, no network. */
export function isValidBtcAddress(address: string): boolean {
  const trimmed = address.trim();
  const lower = trimmed === trimmed.toUpperCase() ? trimmed.toLowerCase() : trimmed;
  if (!/^bc1q/.test(lower)) return false;
  const body = lower.slice(4);
  if (body.length < 11 || body.length > 71) return false;
  return [...body].every((c) => BECH32_CHARSET.includes(c));
}

export function createWalletState(args: { seedWords: string[]; address: string }): WalletState {
  if (args.seedWords.length !== 12) throw new Error("A wallet needs exactly 12 seed words.");
  return {
    exists: true,
    seedWords: [...args.seedWords],
    address: args.address,
    balance: 0,
    history: [],
    confirmedThreshold: WALLET_CONFIRMED_THRESHOLD,
    backupAt: null,
  };
}

export function validateSend(
  wallet: WalletState,
  args: { to: string; amountSats: number; feeTier: FeeTierId },
): string | null {
  if (!isValidBtcAddress(args.to)) {
    return "That doesn't look like a Bitcoin address. It should start with bc1.";
  }
  if (!Number.isSafeInteger(args.amountSats) || args.amountSats <= 0) {
    return "Enter an amount above zero.";
  }
  const total = args.amountSats + feeSatsForTier(args.feeTier);
  if (total > wallet.balance) {
    return "Not enough. Don't forget the fee.";
  }
  return null;
}

/** Debit amount + fee and prepend a pending outgoing tx. Caller validated. */
export function applySend(
  wallet: WalletState,
  args: {
    txid: string;
    to: string;
    amountSats: number;
    feeTier: FeeTierId;
    timestamp: string;
    memo?: string;
  },
): WalletState {
  const fee = feeSatsForTier(args.feeTier);
  const tx: TxRecord = {
    id: args.txid,
    direction: "out",
    amount: args.amountSats,
    counterparty: args.to.trim(),
    status: "pending",
    confirmations: 0,
    fee,
    timestamp: args.timestamp,
    ...(args.memo?.trim() ? { memo: args.memo.trim() } : {}),
  };
  return {
    ...wallet,
    balance: wallet.balance - args.amountSats - fee,
    history: [tx, ...wallet.history],
  };
}

/** Prepend a pending incoming tx. Balance credits when it confirms. */
export function applyDeposit(
  wallet: WalletState,
  args: { txid: string; from: string; amountSats: number; timestamp: string },
): WalletState {
  const tx: TxRecord = {
    id: args.txid,
    direction: "in",
    amount: args.amountSats,
    counterparty: args.from,
    status: "pending",
    confirmations: 0,
    timestamp: args.timestamp,
  };
  return { ...wallet, history: [tx, ...wallet.history] };
}

export type AdvanceResult = { wallet: WalletState; confirmed: boolean };

/** Tick one confirmation onto a tx; credit deposits at the threshold. */
export function advanceTx(wallet: WalletState, txid: string): AdvanceResult {
  const tx = wallet.history.find((t) => t.id === txid);
  if (!tx || tx.status === "confirmed") return { wallet, confirmed: false };
  const confirmations = tx.confirmations + 1;
  const confirmed = confirmations >= wallet.confirmedThreshold;
  const history = wallet.history.map((t) =>
    t.id === txid
      ? { ...t, confirmations, status: confirmed ? ("confirmed" as const) : t.status }
      : t,
  );
  const balance = confirmed && tx.direction === "in" ? wallet.balance + tx.amount : wallet.balance;
  return { wallet: { ...wallet, history, balance }, confirmed };
}

/** True when the 12 entered words match the wallet seed (case-insensitive). */
export function restoreMatches(expected: string[], entered: string[]): boolean {
  if (entered.length !== 12 || expected.length !== 12) return false;
  return entered.every((w, i) => w.trim().toLowerCase() === expected[i]?.trim().toLowerCase());
}

/**
 * Practice wallet sandbox: pure core. No fs, no network — safe to import
 * from client components, API routes, and unit tests alike.
 *
 * All values are simulated and deterministic from the learner's practice
 * seed. The wallet address IS the get-paid/address (same seed, same wallet).
 */

import type { BitcoinNetwork } from "./bitcoin/provider";

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
  /** Block height the tx confirmed in; null while pending or simulated. */
  blockHeight?: number | null;
  /**
   * True when the txid exists on a real chain (regtest faucet fund). Sends
   * are recorded, never broadcast, and simulated deposits are invented, so
   * both stay false. Absent on rows written before the flag existed.
   */
  onChain?: boolean;
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
  /** ISO date of last successful restore check, or null. Absent on old rows. */
  restoredAt?: string | null;
};

export const WALLET_CONFIRMED_THRESHOLD = 3;
/** Counterparty label stored on real regtest faucet funds (see deposit route). */
export const REGTEST_FAUCET_LABEL = "regtest faucet";
/** Fixed simulated deposit per receive flow, in sats (0.005 BTC). */
export const WALLET_DEPOSIT_SATS = 500_000;
/** Assumed tx size for fee estimates. Static simulation, not a live read. */
export const WALLET_TX_VBYTES = 140;
/** Typed confirmation word that authorizes a wallet reset. */
export const WALLET_RESET_WORD = "RESET";

/** 1-based seed positions the setup/backup confirm prompts ask for. */
export const SEED_CONFIRM_POSITIONS = [3, 7, 11] as const;

export type FeeTierId = "economy" | "standard" | "priority";

export type ResolvedFeeTier = {
  id: FeeTierId;
  label: string;
  satPerVb: number;
  etaLabel: string;
};

export const FEE_TIERS: ReadonlyArray<ResolvedFeeTier> = [
  { id: "economy", label: "Economy", satPerVb: 1, etaLabel: "~60 min" },
  { id: "standard", label: "Standard", satPerVb: 5, etaLabel: "~30 min" },
  { id: "priority", label: "Priority", satPerVb: 15, etaLabel: "~10 min" },
];

export function feeSatsForTier(
  tier: FeeTierId,
  tiers: ReadonlyArray<ResolvedFeeTier> = FEE_TIERS,
): number {
  const found = tiers.find((t) => t.id === tier);
  if (!found) throw new Error(`Unknown fee tier: ${tier}`);
  return found.satPerVb * WALLET_TX_VBYTES;
}

/** Map live sat/vB rates onto the static tier shape (labels/etas stay put). */
export function feeTiersFromRates(rates: {
  fastest: number;
  halfHour: number;
  economy: number;
}): ResolvedFeeTier[] {
  const vb = (n: number): number => Math.max(1, Math.round(n));
  return [
    { id: "economy", label: "Economy", satPerVb: vb(rates.economy), etaLabel: "~60 min" },
    { id: "standard", label: "Standard", satPerVb: vb(rates.halfHour), etaLabel: "~30 min" },
    { id: "priority", label: "Priority", satPerVb: vb(rates.fastest), etaLabel: "~10 min" },
  ];
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

/** Trimmed BTC for review rows: 100000 → "0.001", 700 → "0.000007". */
export function formatBtcTrim(sats: number): string {
  const [whole, frac] = satsToBtc(sats).split(".") as [string, string];
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
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

/**
 * P2WPKH shape check: bc1q/tb1q/bcrt1q + bech32 chars. No checksum, no network.
 * Multi-HRP so regtest/signet modes can receive; simulated copy is unchanged.
 */
export function isValidBtcAddress(address: string): boolean {
  const trimmed = address.trim();
  const lower = trimmed === trimmed.toUpperCase() ? trimmed.toLowerCase() : trimmed;
  const m = /^(bc1q|tb1q|bcrt1q)/.exec(lower);
  if (!m) return false;
  const body = lower.slice(m[1].length);
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
    restoredAt: null,
  };
}

/**
 * True when the client's reviewed fee still matches the live tier price.
 * Without a quote (older clients, direct API callers) the live price stands,
 * preserving today's behavior; with one, a moved fee rejects so the learner
 * re-reviews an honest total instead of signing a stale one.
 */
export function feeQuoteMatches(quoted: number | undefined, current: number): boolean {
  if (quoted === undefined) return true;
  return quoted === current;
}

export function validateSend(
  wallet: WalletState,
  args: { to: string; amountSats: number; feeTier: FeeTierId; feeSats?: number },
): string | null {
  if (!isValidBtcAddress(args.to)) {
    return "That doesn't look like a Bitcoin address. It should start with bc1q, tb1q, or bcrt1q.";
  }
  if (!Number.isSafeInteger(args.amountSats) || args.amountSats <= 0) {
    return "Enter an amount.";
  }
  const total = args.amountSats + (args.feeSats ?? feeSatsForTier(args.feeTier));
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
    feeSats?: number;
  },
): WalletState {
  const fee = args.feeSats ?? feeSatsForTier(args.feeTier);
  const tx: TxRecord = {
    id: args.txid,
    direction: "out",
    amount: args.amountSats,
    counterparty: args.to.trim(),
    status: "pending",
    confirmations: 0,
    onChain: false,
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
  args: {
    txid: string;
    from: string;
    amountSats: number;
    timestamp: string;
    onChain?: boolean;
  },
): WalletState {
  const tx: TxRecord = {
    id: args.txid,
    direction: "in",
    amount: args.amountSats,
    counterparty: args.from,
    status: "pending",
    confirmations: 0,
    onChain: args.onChain ?? false,
    timestamp: args.timestamp,
  };
  return { ...wallet, history: [tx, ...wallet.history] };
}

/**
 * True when the txid exists on a real chain and can be polled/linked.
 * Pre-flag rows carry no marker; all real funds were labeled with
 * REGTEST_FAUCET_LABEL, so that label backfills them exactly.
 */
export function isOnChainTx(tx: TxRecord): boolean {
  if (typeof tx.onChain === "boolean") return tx.onChain;
  return tx.counterparty === REGTEST_FAUCET_LABEL;
}

/**
 * True when tick should poll the chain instead of advancing simulated
 * confirmations: regtest mode AND a txid that exists on the chain.
 * Polling an invented txid 404s forever, so sends (never broadcast)
 * always advance, in every mode.
 */
export function shouldPollChain(network: BitcoinNetwork, tx: TxRecord): boolean {
  return network === "regtest" && isOnChainTx(tx);
}

export type ExamTaskId = "setup" | "receive" | "send" | "restore";

/**
 * Store-derived exam tasks (the fifth, read-back, needs a live claim check
 * and is verified at submit). History is newest-first, so examTxid is the
 * newest qualifying deposit — the read-back target.
 */
export type ExamReadiness = Record<ExamTaskId, boolean> & { examTxid: string | null };

export function examReadiness(
  wallet: WalletState | null | undefined,
  network: BitcoinNetwork,
  since?: string | null,
): ExamReadiness {
  const setup =
    !!wallet?.exists && wallet.seedWords.length === 12 && wallet.address.trim().length > 0;
  // Attempt binding: only evidence from at-or-after the exam start counts.
  // Setup stays a precondition (no wallet wipe); the three actions plus the
  // live read-back must be performed during the attempt. ISO timestamps
  // compare chronologically as strings.
  const fresh = (ts: string | null | undefined) => !since || !!ts && ts >= since;
  const deposits = (wallet?.history ?? []).filter(
    (t) =>
      t.direction === "in" &&
      t.status === "confirmed" &&
      (network !== "regtest" || isOnChainTx(t)) &&
      fresh(t.timestamp),
  );
  const receive = deposits.length > 0;
  const send = (wallet?.history ?? []).some(
    (t) => t.direction === "out" && t.status === "confirmed" && fresh(t.timestamp),
  );
  const restore = !!wallet?.restoredAt && fresh(wallet.restoredAt);
  return { setup, receive, send, restore, examTxid: deposits[0]?.id ?? null };
}

export type AdvanceResult = { wallet: WalletState; confirmed: boolean };

/**
 * Apply a polled confirmation count (regtest mode). Credits deposits when the
 * threshold is reached; confirmed txs and unknown ids are a no-op.
 */
export function applyTxStatus(
  wallet: WalletState,
  txid: string,
  status: { confirmations: number; blockHeight?: number | null },
): AdvanceResult {
  const tx = wallet.history.find((t) => t.id === txid);
  if (!tx || tx.status === "confirmed") return { wallet, confirmed: false };
  const confirmations = Math.max(0, Math.floor(status.confirmations));
  const confirmed = confirmations >= wallet.confirmedThreshold;
  const blockHeight = status.blockHeight ?? tx.blockHeight ?? null;
  const history = wallet.history.map((t) =>
    t.id === txid
      ? {
          ...t,
          confirmations,
          blockHeight,
          status: confirmed ? ("confirmed" as const) : t.status,
        }
      : t,
  );
  const balance = confirmed && tx.direction === "in" ? wallet.balance + tx.amount : wallet.balance;
  return { wallet: { ...wallet, history, balance }, confirmed };
}

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

/**
 * Public explorer URL for a txid, or null when there is no chain to look at.
 * Signet uses mempool.space; regtest uses the local Esplora UI (override
 * with ESPLORA_PUBLIC_URL when it does not run on localhost:5000).
 * Callers must gate on isOnChainTx first: invented txids (sends in every
 * mode, simulated deposits) 404 on any explorer, so linking them is a lie.
 */
export function explorerTxUrl(
  network: BitcoinNetwork,
  txid: string,
  esploraBase = "http://localhost:5000",
): string | null {
  if (!/^[0-9a-f]{64}$/i.test(txid)) return null;
  switch (network) {
    case "signet":
      return `https://mempool.space/signet/tx/${txid}`;
    case "regtest":
      return `${esploraBase.replace(/\/+$/, "")}/tx/${txid}`;
    default:
      return null;
  }
}

/** True when the 12 entered words match the wallet seed (case-insensitive). */
export function restoreMatches(expected: string[], entered: string[]): boolean {
  if (entered.length !== 12 || expected.length !== 12) return false;
  return entered.every((w, i) => w.trim().toLowerCase() === expected[i]?.trim().toLowerCase());
}

/**
 * Paste-all distribution for the 12 restore slots: if `text` holds several
 * whitespace-separated words, spread them across slots starting at `at`
 * (clamped to 12); otherwise set the single slot.
 */
export function distributeRestoreWords(slots: string[], at: number, text: string): string[] {
  const next = [...slots];
  while (next.length < 12) next.push("");
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    tokens.slice(0, 12 - at).forEach((t, k) => {
      next[at + k] = t;
    });
    return next;
  }
  next[at] = text;
  return next;
}

/** "just now" / "N minutes ago" / … for the settings "Last backed up" line. */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const diffMs = Math.max(0, nowMs - Date.parse(iso));
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

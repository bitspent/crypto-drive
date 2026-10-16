"use client";

import { useState } from "react";
import {
  formatBtcGrouped,
  truncateMiddle,
  type TxRecord,
  type WalletState,
} from "@/lib/wallet";

function DirectionIcon({ direction }: { direction: TxRecord["direction"] }) {
  return (
    <span
      aria-hidden="true"
      className={`w-dir-icon ${direction === "in" ? "w-dir-in" : "w-dir-out"}`}
    >
      {direction === "in" ? "↓" : "↑"}
    </span>
  );
}

function StatusBadge({ tx, threshold }: { tx: TxRecord; threshold: number }) {
  if (tx.status === "confirmed") {
    return (
      <span className="w-badge w-badge-confirmed">
        <span aria-hidden="true">✓</span> Confirmed
      </span>
    );
  }
  return (
    <span className="w-badge w-badge-pending">
      <span aria-hidden="true" className="w-badge-dot" />
      {tx.confirmations}/{threshold}
    </span>
  );
}

function HistoryRow({ tx, threshold }: { tx: TxRecord; threshold: number }) {
  const incoming = tx.direction === "in";
  return (
    <li className="w-history-row">
      <DirectionIcon direction={tx.direction} />
      <div className="w-row-main">
        <p className="w-row-title">{incoming ? "Received" : "Sent"}</p>
        <p className="w-row-sub">
          {incoming ? "from" : "to"} {truncateMiddle(tx.counterparty)}
        </p>
      </div>
      <div className="w-row-side">
        <p className={`w-row-amount ${incoming ? "w-amount-in" : "w-amount-out"}`}>
          {incoming ? "+" : "−"}
          {formatBtcGrouped(tx.amount)} BTC
        </p>
        <StatusBadge tx={tx} threshold={threshold} />
      </div>
    </li>
  );
}

function WalletIcon() {
  return (
    <svg
      className="w-empty-icon"
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "var(--amber)" }}
    >
      <rect x="6" y="12" width="36" height="26" rx="6" />
      <path d="M6 20h20" />
      <circle cx="34" cy="27" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EmptyState({
  onCreate,
  creating,
  error,
}: {
  onCreate: () => void;
  creating: boolean;
  error: string | null;
}) {
  return (
    <div className="w-shell">
      <div className="w-topbar">
        <span>Practice wallet</span>
      </div>
      <p className="w-disclosure">Practice wallet · Play money · No real Bitcoin</p>
      <div className="w-card w-empty-state">
        <WalletIcon />
        <h2>You don&apos;t have a wallet yet.</h2>
        <p>Create one to practice receiving, sending, and backing up.</p>
        <button type="button" className="w-primary-btn" onClick={onCreate} disabled={creating}>
          {creating ? "Creating…" : "Create your wallet"}
        </button>
        {error ? (
          <p className="w-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function WalletApp({ initial }: { initial: WalletState | null }) {
  const [wallet, setWallet] = useState<WalletState | null>(initial);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachVisible, setCoachVisible] = useState(true);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet", { method: "POST" });
      const data = (await res.json()) as { wallet?: WalletState; error?: string };
      if (!res.ok || !data.wallet) throw new Error(data.error || "Could not create wallet.");
      setWallet(data.wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create wallet.");
    } finally {
      setCreating(false);
    }
  }

  if (!wallet) {
    return <EmptyState onCreate={create} creating={creating} error={error} />;
  }

  return (
    <div className="w-shell">
      <div className="w-topbar">
        <span>Practice wallet</span>
      </div>
      <p className="w-disclosure">Practice wallet · Play money · No real Bitcoin</p>

      <div className="w-balance-block">
        <p className="w-balance" aria-live="polite" aria-label={`${wallet.balance} satoshis`}>
          {formatBtcGrouped(wallet.balance)}
        </p>
        <p className="w-balance-unit">BTC</p>
        <p className="w-balance-sub">≈ {wallet.balance.toLocaleString("en-US")} sats</p>
      </div>

      <div className="w-actions">
        <button type="button" className="w-receive-btn">
          Receive
        </button>
        <button type="button" className="w-send-btn">
          Send
        </button>
      </div>

      <h2 className="w-section-label">Activity</h2>
      {wallet.history.length === 0 ? (
        <p className="w-empty-history">No activity yet.</p>
      ) : (
        <ul className="w-history">
          {wallet.history.map((tx) => (
            <HistoryRow key={tx.id} tx={tx} threshold={wallet.confirmedThreshold} />
          ))}
        </ul>
      )}

      {coachVisible ? (
        <div className="w-coach-note">
          <p>Receive first. That&apos;s how wallets get money.</p>
          <button
            type="button"
            className="w-coach-dismiss"
            aria-label="Dismiss"
            onClick={() => setCoachVisible(false)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

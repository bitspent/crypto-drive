"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SEED_CONFIRM_POSITIONS,
  formatBtcGrouped,
  truncateMiddle,
  type TxRecord,
  type WalletState,
} from "@/lib/wallet";

const REVEAL_MASK_MS = 5000;

function WalletTop() {
  return (
    <>
      <div className="w-topbar">
        <span>Practice wallet</span>
      </div>
      <p className="w-disclosure">Practice wallet · Play money · No real Bitcoin</p>
    </>
  );
}

function CoachNote({ text }: { text: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="w-coach-note">
      <p>{text}</p>
      <button
        type="button"
        className="w-coach-dismiss"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  );
}

export function SeedGrid({ words, masked }: { words: string[]; masked: boolean }) {
  return (
    <ol className="w-seed-grid" aria-label={masked ? "Seed words hidden" : "Seed words"}>
      {words.map((word, i) => (
        <li key={i} className="w-seed-cell">
          <span className="w-seed-num">{i + 1}</span>
          <span className={`w-seed-word${masked ? " w-seed-masked" : ""}`}>
            {masked ? "••••••" : word}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SeedReveal({ words, onDone }: { words: string[]; onDone: () => void }) {
  // showing → masked (once, 5s in) → reshown (stays; writing takes a while).
  const [maskState, setMaskState] = useState<"showing" | "masked" | "reshown">("showing");
  useEffect(() => {
    if (maskState !== "showing") return;
    const timer = window.setTimeout(() => setMaskState("masked"), REVEAL_MASK_MS);
    return () => window.clearTimeout(timer);
  }, [maskState]);
  const revealed = maskState !== "showing";

  return (
    <div className="w-shell">
      <WalletTop />
      <h2 className="w-flow-title">Your 12 words</h2>
      <p className="w-flow-sub">
        Write them down on paper. In order. Never photograph them. Never share them.
      </p>
      <SeedGrid words={words} masked={maskState === "masked"} />
      <CoachNote text="These words ARE your wallet. Lose them, lose the coins." />
      <div className="w-button-stack">
        <button
          type="button"
          className="w-primary-btn w-block-btn"
          disabled={!revealed}
          onClick={onDone}
        >
          I&apos;ve written them down
        </button>
        {maskState === "masked" ? (
          <button
            type="button"
            className="w-secondary-btn w-block-btn"
            onClick={() => setMaskState("reshown")}
          >
            Show them again
          </button>
        ) : null}
      </div>
    </div>
  );
}

function shuffledIndices(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = order[i] as number;
    order[i] = order[j] as number;
    order[j] = a;
  }
  return order;
}

function SeedConfirm({ words, onDone }: { words: string[]; onDone: () => void }) {
  const [round, setRound] = useState(0);
  const [doneIdx, setDoneIdx] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const order = useMemo(() => shuffledIndices(words.length), [words.length]);
  const wantPos = SEED_CONFIRM_POSITIONS[round] as number;

  function tap(i: number) {
    if (doneIdx.includes(i)) return;
    if (i === wantPos - 1) {
      setDoneIdx((done) => [...done, i]);
      setError(null);
      if (round === SEED_CONFIRM_POSITIONS.length - 1) onDone();
      else setRound(round + 1);
    } else {
      setError(`That's not word ${wantPos}.`);
      const grid = gridRef.current;
      if (grid) {
        grid.classList.remove("w-shake");
        void grid.offsetWidth;
        grid.classList.add("w-shake");
      }
    }
  }

  return (
    <div className="w-shell">
      <WalletTop />
      <h2 className="w-flow-title">Prove it</h2>
      <p className="w-flow-sub">Tap the words we ask for.</p>
      <p className="w-confirm-prompt" aria-live="polite">
        Tap word {wantPos}
      </p>
      <p className="w-confirm-progress">
        Word {round + 1} of {SEED_CONFIRM_POSITIONS.length}
      </p>
      <div ref={gridRef} className="w-confirm-grid" role="group" aria-label="Word choices">
        {order.map((i) => {
          const spent = doneIdx.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={spent}
              onClick={() => tap(i)}
              className={`w-confirm-word${spent ? " w-confirm-spent" : ""}`}
            >
              {words[i]}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="w-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

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
      <WalletTop />
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
  const [phase, setPhase] = useState<"home" | "reveal" | "confirm">("home");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet", { method: "POST" });
      const data = (await res.json()) as { wallet?: WalletState; error?: string };
      if (!res.ok || !data.wallet) throw new Error(data.error || "Could not create wallet.");
      setWallet(data.wallet);
      setPhase("reveal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create wallet.");
    } finally {
      setCreating(false);
    }
  }

  if (!wallet) {
    return <EmptyState onCreate={create} creating={creating} error={error} />;
  }
  if (phase === "reveal") {
    return <SeedReveal words={wallet.seedWords} onDone={() => setPhase("confirm")} />;
  }
  if (phase === "confirm") {
    return <SeedConfirm words={wallet.seedWords} onDone={() => setPhase("home")} />;
  }

  return (
    <div className="w-shell">
      <WalletTop />

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

      <CoachNote text="Receive first. That's how wallets get money." />
    </div>
  );
}

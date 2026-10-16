"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  SEED_CONFIRM_POSITIONS,
  formatBtcGrouped,
  truncateMiddle,
  type TxRecord,
  type WalletState,
} from "@/lib/wallet";

const DEPOSIT_DELAY_MS = 3000;
const TICK_MS = 4000;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function AnimatedBalance({ sats, reduced }: { sats: number; reduced: boolean }) {
  const [shown, setShown] = useState(sats);
  const prevRef = useRef(sats);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = sats;
    if (from === sats || reduced) {
      setShown(sats);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 400);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (sats - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sats, reduced]);
  return (
    <>
      <p className="w-balance" aria-live="polite" aria-label={`${sats} satoshis`}>
        {formatBtcGrouped(shown)}
      </p>
      <p className="w-balance-unit">BTC</p>
      <p className="w-balance-sub">≈ {sats.toLocaleString("en-US")} sats</p>
    </>
  );
}

function CopyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="9" height="9" rx="2" />
      <path d="M12 6V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

function ReceiveSheet({ address, onClose }: { address: string; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(address, { width: 240, margin: 0 })
      .then((url) => {
        if (live) setQr(url);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [address]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const els = [...panelRef.current.querySelectorAll<HTMLElement>("button")].filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
      );
      if (els.length === 0) return;
      const first = els[0] as HTMLElement;
      const last = els[els.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions, insecure context): leave silent.
    }
  }

  return (
    <div className="w-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your address"
        className="w-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-sheet-head">
          <h2>Your address</h2>
          <button
            ref={closeRef}
            type="button"
            className="w-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="w-qr-tile">
          {qr ? (
            // Data-URL QR: next/image optimization does not apply.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${address}`} width={240} height={240} />
          ) : (
            <p className="w-qr-loading">Drawing code…</p>
          )}
        </div>
        <div className="w-addr-row">
          <p className="w-addr-full">{address}</p>
          <button
            type="button"
            className="w-copy-btn"
            aria-label="Copy address"
            onClick={copy}
          >
            {copied ? <span aria-hidden="true">✓</span> : <CopyIcon />}
          </button>
        </div>
        {copied ? (
          <p className="w-copied" role="status">
            Copied.
          </p>
        ) : null}
        <p className="w-caption">Bitcoin only. Not for any other coin.</p>
        <CoachNote text="Your address is safe to share. That's the point." />
      </div>
    </div>
  );
}

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
    <span className="w-badge w-badge-pending w-tick-pop">
      <span aria-hidden="true" className="w-badge-dot" />
      {tx.confirmations}/{threshold}
    </span>
  );
}

function HistoryRow({
  tx,
  threshold,
  arriving,
}: {
  tx: TxRecord;
  threshold: number;
  arriving: boolean;
}) {
  const incoming = tx.direction === "in";
  return (
    <li className={`w-history-row${arriving ? " w-row-enter" : ""}`}>
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
        <StatusBadge
          key={tx.status === "pending" ? tx.confirmations : "done"}
          tx={tx}
          threshold={threshold}
        />
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
  const [sheet, setSheet] = useState<null | "receive">(null);
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const receiveRef = useRef<HTMLButtonElement>(null);
  const walletRef = useRef(wallet);
  const tickingRef = useRef(false);
  const timerRef = useRef(0);

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  const tickOnce = useCallback(async (): Promise<boolean> => {
    const current = walletRef.current;
    if (!current) return false;
    const pending = current.history.filter((t) => t.status === "pending");
    if (pending.length === 0) return false;
    let latest: WalletState = current;
    for (const tx of pending) {
      const res = await fetch("/api/wallet/tick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txid: tx.id }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { wallet: WalletState };
      latest = data.wallet;
    }
    walletRef.current = latest;
    setWallet(latest);
    return latest.history.some((t) => t.status === "pending");
  }, []);

  const startTickLoop = useCallback(() => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    const round = async () => {
      const more = await tickOnce().catch(() => true);
      if (more) {
        timerRef.current = window.setTimeout(round, TICK_MS);
      } else {
        tickingRef.current = false;
      }
    };
    timerRef.current = window.setTimeout(round, TICK_MS);
  }, [tickOnce]);

  useEffect(() => {
    if (walletRef.current?.history.some((t) => t.status === "pending")) startTickLoop();
    return () => {
      window.clearTimeout(timerRef.current);
      tickingRef.current = false;
    };
  }, [startTickLoop]);

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

  function closeReceive() {
    setSheet(null);
    receiveRef.current?.focus();
    window.setTimeout(async () => {
      const res = await fetch("/api/wallet/deposit", { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { tx: TxRecord; wallet: WalletState };
      walletRef.current = data.wallet;
      setArrivingId(data.tx.id);
      setWallet(data.wallet);
      startTickLoop();
      window.setTimeout(() => {
        setArrivingId((id) => (id === data.tx.id ? null : id));
      }, 600);
    }, DEPOSIT_DELAY_MS);
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

  const incoming = wallet.history.filter((t) => t.direction === "in");
  const sawFirstConfirmation = incoming.some((t) => t.confirmations >= 1);
  const sawConfirmed = incoming.some((t) => t.status === "confirmed");

  return (
    <div className="w-shell">
      <WalletTop />

      <div className="w-balance-block">
        <AnimatedBalance sats={wallet.balance} reduced={reduced} />
      </div>

      <div className="w-actions">
        <button
          ref={receiveRef}
          type="button"
          className="w-receive-btn"
          onClick={() => setSheet("receive")}
        >
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
            <HistoryRow
              key={tx.id}
              tx={tx}
              threshold={wallet.confirmedThreshold}
              arriving={tx.id === arrivingId}
            />
          ))}
        </ul>
      )}

      {wallet.history.length === 0 ? (
        <CoachNote text="Receive first. That's how wallets get money." />
      ) : null}
      {sawFirstConfirmation ? (
        <CoachNote text="Confirmations make a payment harder to reverse." />
      ) : null}
      {sawConfirmed ? (
        <CoachNote text="You don't do anything. The balance updates itself." />
      ) : null}

      {sheet === "receive" ? (
        <ReceiveSheet address={wallet.address} onClose={closeReceive} />
      ) : null}
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import QRCode from "qrcode";
import {
  FEE_TIERS,
  SEED_CONFIRM_POSITIONS,
  distributeRestoreWords,
  feeSatsForTier,
  formatBtcGrouped,
  formatBtcTrim,
  formatRelativeTime,
  isValidBtcAddress,
  parseBtcToSats,
  truncateMiddle,
  type FeeTierId,
  type ResolvedFeeTier,
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

function useDialogKeys(
  panelRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const els = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          "button, input, textarea, select",
        ),
      ].filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true" &&
          el.tabIndex >= 0,
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
  }, [panelRef, onClose]);
}

export type SendDraft = {
  to: string;
  amountSats: number;
  feeTier: FeeTierId;
  feeSats: number;
  memo: string;
};

const ADDRESS_ERROR = "That doesn't look like a Bitcoin address. It should start with bc1.";
const AMOUNT_ERROR = "Enter an amount.";
const FUNDS_ERROR = "Not enough. Don't forget the fee.";

function SendSheet({
  balance,
  onClose,
  onReview,
}: {
  balance: number;
  onClose: () => void;
  onReview: (draft: SendDraft) => void;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [feeTier, setFeeTier] = useState<FeeTierId>("standard");
  const [tiers, setTiers] = useState<ResolvedFeeTier[]>(() => [...FEE_TIERS]);
  const [toError, setToError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  useDialogKeys(panelRef, onClose);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // Live tiers for signet/regtest; simulated resolves to the same static
  // tiers, and any failure keeps them. Secrets stay server-side: the
  // browser never imports the provider, only this route.
  useEffect(() => {
    let live = true;
    fetch("/api/wallet/fees")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        const list = (data as { tiers?: ResolvedFeeTier[] } | null)?.tiers;
        if (
          live &&
          Array.isArray(list) &&
          list.length === 3 &&
          list.every((t) => typeof t?.satPerVb === "number")
        ) {
          setTiers(list);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const amountSats = parseBtcToSats(amount.trim());
  const feeSats = feeSatsForTier(feeTier, tiers);

  function checkAddress(value: string): string | null {
    return value.trim() && !isValidBtcAddress(value.trim()) ? ADDRESS_ERROR : null;
  }

  function checkAmount(sats: number | null): string | null {
    if (sats === null || sats <= 0) return AMOUNT_ERROR;
    if (sats + feeSats > balance) return FUNDS_ERROR;
    return null;
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      setTo(text.trim());
      setToError(checkAddress(text));
    } catch {
      // Clipboard unavailable: leave the field for typing.
    }
  }

  function review() {
    const tErr = to.trim() ? checkAddress(to) : ADDRESS_ERROR;
    const aErr = checkAmount(amountSats);
    setToError(tErr);
    setAmountError(aErr);
    if (tErr || aErr || amountSats === null) return;
    onReview({ to: to.trim(), amountSats, feeTier, feeSats, memo: memo.trim() });
  }

  return (
    <div className="w-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Send bitcoin"
        className="w-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-sheet-head">
          <h2>Send</h2>
          <button
            type="button"
            className="w-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="w-field">
          <label className="w-field-label" htmlFor="w-send-to">
            Recipient address
          </label>
          <span className="w-input-row">
            <input
              ref={firstRef}
              id="w-send-to"
              type="text"
              className="w-input w-mono"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                if (toError) setToError(checkAddress(e.target.value));
              }}
              onBlur={() => setToError(checkAddress(to))}
              aria-invalid={toError ? true : undefined}
              aria-describedby={toError ? "w-send-to-error" : undefined}
              placeholder="bc1q…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="w-paste-btn" onClick={paste}>
              Paste
            </button>
          </span>
        </div>
        {toError ? (
          <p id="w-send-to-error" className="w-field-error" role="alert">
            {toError}
          </p>
        ) : null}

        <label className="w-field">
          <span className="w-field-label">Amount (BTC)</span>
          <input
            type="text"
            inputMode="decimal"
            className="w-input w-amount-input"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (amountError) setAmountError(checkAmount(parseBtcToSats(e.target.value.trim())));
            }}
            onBlur={() => {
              if (amount.trim()) setAmountError(checkAmount(amountSats));
            }}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? "w-send-amount-error" : "w-send-sats"}
            placeholder="0.001"
            autoComplete="off"
          />
        </label>
        {amountSats !== null && amountSats > 0 ? (
          <p id="w-send-sats" className="w-sats-equiv">
            ≈ {amountSats.toLocaleString("en-US")} sats
          </p>
        ) : (
          <p id="w-send-sats" className="w-sats-equiv w-sats-empty" aria-hidden="true">
            &nbsp;
          </p>
        )}
        {amountError ? (
          <p id="w-send-amount-error" className="w-field-error" role="alert">
            {amountError}
          </p>
        ) : null}

        <label className="w-field">
          <span className="w-field-label">Memo (optional)</span>
          <input
            type="text"
            className="w-input"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Only you will see this"
            autoComplete="off"
            maxLength={120}
          />
        </label>

        <fieldset className="w-fee-field">
          <legend className="w-field-label">Fee</legend>
          <div className="w-fee-pills">
            {tiers.map((tier) => (
              <label
                key={tier.id}
                className={`w-fee-pill${feeTier === tier.id ? " w-fee-pill-on" : ""}`}
              >
                <input
                  type="radio"
                  name="w-fee-tier"
                  value={tier.id}
                  checked={feeTier === tier.id}
                  onChange={() => {
                    setFeeTier(tier.id);
                    if (amountError) {
                      setAmountError(checkAmount(amountSats));
                    }
                  }}
                  className="w-sr-only"
                />
                <span className="w-fee-name">{tier.label}</span>
                <span className="w-fee-sub">
                  {feeSatsForTier(tier.id, tiers).toLocaleString("en-US")} sats · {tier.etaLabel}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <CoachNote text="Small test first. Send a little before you send a lot." />
        <CoachNote text="The fee comes out of the same balance." />

        <button type="button" className="w-send-btn w-full" onClick={review}>
          Review
        </button>
      </div>
    </div>
  );
}

function ReviewSheet({
  balance,
  draft,
  reduced,
  onCancel,
  onSent,
}: {
  balance: number;
  draft: SendDraft;
  reduced: boolean;
  onCancel: () => void;
  onSent: (wallet: WalletState, tx: TxRecord) => void;
}) {
  const [checked, setChecked] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogKeys(panelRef, onCancel);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const feeSats = draft.feeSats;
  const total = draft.amountSats + feeSats;
  const remaining = balance - total;
  const [toHead, toTail] = truncateMiddle(draft.to).split("…");

  async function sign() {
    if (!checked || signing) return;
    setSigning(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: draft.to,
          amountSats: draft.amountSats,
          feeTier: draft.feeTier,
          memo: draft.memo,
        }),
      });
      const data = (await res.json()) as { tx?: TxRecord; wallet?: WalletState; error?: string };
      if (!res.ok || !data.tx || !data.wallet) {
        throw new Error(data.error || "Could not send.");
      }
      if (!reduced) {
        const wait = 600 - (performance.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
      onSent(data.wallet, data.tx);
    } catch (err) {
      setSigning(false);
      setError(err instanceof Error ? err.message : "Could not send.");
    }
  }

  return (
    <div className="w-overlay" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Review and send"
        className="w-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-sheet-head">
          <h2>Review</h2>
          <button
            ref={cancelRef}
            type="button"
            className="w-icon-btn"
            aria-label="Close"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <dl className="w-review-rows">
          <div className="w-review-row">
            <dt>To</dt>
            <dd className="w-mono">
              {toHead}…<span className="w-amber">{toTail ?? ""}</span>
            </dd>
          </div>
          <div className="w-review-row">
            <dt>Amount</dt>
            <dd>
              {formatBtcTrim(draft.amountSats)} BTC (
              {draft.amountSats.toLocaleString("en-US")} sats)
            </dd>
          </div>
          <div className="w-review-row">
            <dt>Fee</dt>
            <dd>
              {formatBtcTrim(feeSats)} BTC ({feeSats.toLocaleString("en-US")} sats)
            </dd>
          </div>
          <div className="w-review-row">
            <dt>Total</dt>
            <dd>{formatBtcTrim(total)} BTC</dd>
          </div>
          <div className="w-review-row">
            <dt>Remaining</dt>
            <dd>{formatBtcTrim(remaining)} BTC</dd>
          </div>
        </dl>

        <CoachNote text="There's no undo. Check the recipient's last 6 characters." />

        <label className="w-check-row">
          <input
            type="checkbox"
            className="w-check"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>I checked the last 6 characters.</span>
        </label>

        {error ? (
          <p className="w-field-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="w-review-actions">
          <button
            type="button"
            className={`w-send-btn w-full${signing ? " w-signing" : ""}`}
            disabled={!checked || signing}
            onClick={sign}
          >
            {signing ? "Signing…" : "Sign and send"}
          </button>
          <button type="button" className="w-receive-btn w-full" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const REVEAL_MASK_MS = 5000;

function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6.2" strokeWidth="3.4" strokeDasharray="2.9 2.35" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WalletTop({
  onOpenSettings,
  gearRef,
}: {
  onOpenSettings?: () => void;
  gearRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <>
      <div className="w-topbar">
        <span>Practice wallet</span>
        {onOpenSettings ? (
          <button
            ref={gearRef}
            type="button"
            className="w-gear-btn"
            aria-label="Settings"
            aria-haspopup="menu"
            onClick={onOpenSettings}
          >
            <GearIcon />
          </button>
        ) : null}
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

function SeedReveal({
  words,
  onDone,
  onCancel,
}: {
  words: string[];
  onDone: () => void;
  onCancel?: () => void;
}) {
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
        {onCancel ? (
          <button
            type="button"
            className="w-secondary-btn w-block-btn"
            onClick={onCancel}
          >
            Back to wallet
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

function SeedConfirm({
  words,
  onDone,
  onCancel,
}: {
  words: string[];
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [round, setRound] = useState(0);
  const [doneIdx, setDoneIdx] = useState<number[]>([]);
  const [hitIdx, setHitIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLParagraphElement>(null);
  const order = useMemo(() => shuffledIndices(words.length), [words.length]);
  const wantPos = SEED_CONFIRM_POSITIONS[round] as number;

  // Land focus on each NEW prompt so keyboard and screen-reader users start
  // the round on the instruction, not on the word they just tapped.
  const firstRound = useRef(true);
  useEffect(() => {
    if (firstRound.current) {
      firstRound.current = false;
      return;
    }
    promptRef.current?.focus({ preventScroll: true });
  }, [round]);

  useEffect(() => {
    if (hitIdx === null) return;
    const t = window.setTimeout(() => setHitIdx(null), 350);
    return () => window.clearTimeout(t);
  }, [hitIdx]);

  function tap(i: number) {
    if (doneIdx.includes(i)) return;
    if (i === wantPos - 1) {
      setDoneIdx((done) => [...done, i]);
      setHitIdx(i);
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
      <p
        key={round}
        ref={promptRef}
        tabIndex={-1}
        className="w-confirm-prompt w-prompt-in"
        aria-live="polite"
      >
        Tap word <span className="w-confirm-num">{wantPos}</span>
      </p>
      <div key={`dots-${round}`} className="w-confirm-dots" aria-hidden="true">
        {SEED_CONFIRM_POSITIONS.map((_, d) => (
          <span
            key={d}
            className={
              d < round
                ? "w-confirm-dot w-confirm-dot-done"
                : d === round
                  ? "w-confirm-dot w-confirm-dot-current"
                  : "w-confirm-dot"
            }
          />
        ))}
      </div>
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
              className={`w-confirm-word${spent ? " w-confirm-spent" : ""}${hitIdx === i ? " w-confirm-hit" : ""}`}
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
      {onCancel ? (
        <div className="w-button-stack">
          <button
            type="button"
            className="w-secondary-btn w-block-btn"
            onClick={onCancel}
          >
            Back to wallet
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SettingsMenu({
  backupAt,
  onClose,
  onBackup,
  onRestore,
  onReset,
}: {
  backupAt: string | null;
  onClose: () => void;
  onBackup: () => void;
  onRestore: () => void;
  onReset: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  useDialogKeys(panelRef, onClose);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  return (
    <div className="w-menu-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="menu"
        aria-label="Wallet settings"
        className="w-menu"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={firstRef}
          type="button"
          role="menuitem"
          className="w-menu-item"
          onClick={onBackup}
        >
          Back up your wallet
        </button>
        <button
          type="button"
          role="menuitem"
          className="w-menu-item"
          onClick={onRestore}
        >
          Restore a wallet
        </button>
        <button
          type="button"
          role="menuitem"
          className="w-menu-item w-menu-danger"
          onClick={onReset}
        >
          Reset wallet
        </button>
        {backupAt ? (
          <p className="w-menu-meta">Last backed up: {formatRelativeTime(backupAt)}</p>
        ) : null}
        <p className="w-menu-meta">Practice wallet · Play money · No real Bitcoin</p>
      </div>
    </div>
  );
}

function BackupDone({ backupAt, onBack }: { backupAt: string; onBack: () => void }) {
  const date = new Date(backupAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="w-shell">
      <WalletTop />
      <div className="w-done-card" role="status">
        <p className="w-done-check" aria-hidden="true">
          ✓
        </p>
        <p className="w-done-text">Backed up on {date}.</p>
      </div>
      <div className="w-button-stack">
        <button type="button" className="w-primary-btn w-block-btn" onClick={onBack}>
          Back to wallet
        </button>
      </div>
    </div>
  );
}

function RestoreSheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"warn" | "form">("warn");
  const [slots, setSlots] = useState<string[]>(() => Array<string>(12).fill(""));
  const [result, setResult] = useState<null | { match: boolean }>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogKeys(panelRef, onClose);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function setSlot(i: number, text: string) {
    setSlots((s) => distributeRestoreWords(s, i, text));
    setResult(null);
    setError(null);
  }

  async function check() {
    if (slots.some((s) => !s.trim())) {
      setError("Enter all 12 words.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ words: slots }),
      });
      const data = (await res.json()) as { match?: boolean; error?: string };
      if (!res.ok || typeof data.match !== "boolean") {
        throw new Error(data.error || "Could not check words.");
      }
      setResult({ match: data.match });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check words.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="w-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Restore a wallet"
        className="w-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-sheet-head">
          <h2>Restore a wallet</h2>
          <button
            ref={cancelRef}
            type="button"
            className="w-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {step === "warn" ? (
          <>
            <p className="w-warn-text">
              This replaces your current wallet. You&apos;ll lose the practice balance if
              you don&apos;t have the words. Continue?
            </p>
            <div className="w-review-actions">
              <button
                type="button"
                className="w-send-btn w-full"
                onClick={() => setStep("form")}
              >
                Continue
              </button>
              <button
                type="button"
                className="w-receive-btn w-full"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="w-caption">Enter your 12 words in order.</p>
            <div className="w-restore-grid">
              {slots.map((value, i) => (
                <label key={i} className="w-restore-slot">
                  <span className="w-restore-num">{i + 1}</span>
                  <input
                    type="text"
                    className="w-input w-mono w-restore-input"
                    aria-label={`Word ${i + 1}`}
                    value={value}
                    onChange={(e) => setSlot(i, e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>
              ))}
            </div>
            {error ? (
              <p className="w-field-error" role="alert">
                {error}
              </p>
            ) : null}
            {result?.match ? (
              <p className="w-restore-ok" role="status">
                Same wallet. Same address. Same balance.
              </p>
            ) : null}
            {result && !result.match ? (
              <p className="w-field-error" role="alert">
                Those don&apos;t match your saved words. Nothing changed.
              </p>
            ) : null}
            <div className="w-review-actions">
              <button
                type="button"
                className="w-send-btn w-full"
                disabled={checking}
                onClick={check}
              >
                {checking ? "Checking…" : "Check words"}
              </button>
              <button
                type="button"
                className="w-receive-btn w-full"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResetSheet({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useDialogKeys(panelRef, onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function reset() {
    if (value !== "RESET" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: value }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not reset.");
      onReset();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not reset.");
    }
  }

  return (
    <div className="w-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reset wallet"
        className="w-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-sheet-head">
          <h2>Reset wallet</h2>
          <button
            type="button"
            className="w-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="w-warn-text">Type RESET to confirm.</p>
        <label className="w-field">
          <span className="w-sr-only">Type RESET to confirm</span>
          <input
            ref={inputRef}
            type="text"
            className="w-input w-mono"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {error ? (
          <p className="w-field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="w-review-actions">
          <button
            type="button"
            className="w-danger-btn w-full"
            disabled={value !== "RESET" || busy}
            onClick={reset}
          >
            {busy ? "Resetting…" : "Reset wallet"}
          </button>
          <button type="button" className="w-receive-btn w-full" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
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

function TxDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="w-tx-row">
      <p className="w-tx-label">{label}</p>
      <div className="w-tx-value">{children}</div>
    </div>
  );
}

function TxDetailsSheet({
  tx,
  threshold,
  onClose,
}: {
  tx: TxRecord;
  threshold: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const incoming = tx.direction === "in";

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useDialogKeys(panelRef, onClose);

  async function copyTxid() {
    try {
      await navigator.clipboard.writeText(tx.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions, insecure context): leave silent.
    }
  }

  const block =
    tx.status !== "confirmed"
      ? "Pending"
      : (tx.blockHeight ?? "Simulated");

  return (
    <div className="w-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Transaction details"
        className="w-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-sheet-head">
          <h2>{incoming ? "Received" : "Sent"}</h2>
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
        <div className="w-tx-rows">
          <TxDetailRow label="Status">
            <StatusBadge tx={tx} threshold={threshold} />
          </TxDetailRow>
          <TxDetailRow label="Amount">
            <p className={`w-tx-amount ${incoming ? "w-amount-in" : "w-amount-out"}`}>
              {incoming ? "+" : "−"}
              {formatBtcGrouped(tx.amount)} BTC
            </p>
            <p className="w-tx-sub">≈ {tx.amount.toLocaleString("en-US")} sats</p>
          </TxDetailRow>
          <TxDetailRow label={incoming ? "From" : "To"}>
            <p className="w-tx-mono">{truncateMiddle(tx.counterparty)}</p>
          </TxDetailRow>
          <TxDetailRow label="Transaction ID">
            <div className="w-tx-id-row">
              <p className="w-tx-mono">{truncateMiddle(tx.id)}</p>
              <button
                type="button"
                className="w-copy-btn"
                aria-label="Copy transaction ID"
                onClick={copyTxid}
              >
                {copied ? <span aria-hidden="true">✓</span> : <CopyIcon />}
              </button>
            </div>
            {copied ? (
              <p className="w-copied" role="status">
                Copied.
              </p>
            ) : null}
          </TxDetailRow>
          <TxDetailRow label="Confirmations">
            <p className="w-tx-plain">
              {tx.status === "confirmed" ? "Confirmed" : `${tx.confirmations}/${threshold}`}
            </p>
          </TxDetailRow>
          <TxDetailRow label="Block">
            <p className="w-tx-plain">{block}</p>
          </TxDetailRow>
          <TxDetailRow label="Date">
            <p className="w-tx-plain">
              {new Date(tx.timestamp).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </TxDetailRow>
          {tx.fee != null ? (
            <TxDetailRow label="Fee">
              <p className="w-tx-plain">
                {formatBtcGrouped(tx.fee)} BTC (≈ {tx.fee.toLocaleString("en-US")} sats)
              </p>
            </TxDetailRow>
          ) : null}
          {tx.memo ? (
            <TxDetailRow label="Memo">
              <p className="w-tx-plain">{tx.memo}</p>
            </TxDetailRow>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({
  tx,
  threshold,
  arriving,
  onOpen,
}: {
  tx: TxRecord;
  threshold: number;
  arriving: boolean;
  onOpen: (txid: string) => void;
}) {
  const incoming = tx.direction === "in";
  const state =
    tx.status === "confirmed"
      ? "confirmed"
      : `${tx.confirmations} of ${threshold} confirmations`;
  return (
    <li className={`w-history-row${arriving ? " w-row-enter" : ""}`}>
      <button
        type="button"
        id={`w-tx-${tx.id}`}
        className="w-history-btn"
        onClick={() => onOpen(tx.id)}
        aria-label={`${incoming ? "Received" : "Sent"} ${formatBtcTrim(tx.amount)} bitcoin, ${state}. Show details.`}
      >
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
      </button>
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
  const [sheet, setSheet] = useState<
    null | "receive" | "send" | "review" | "restore" | "reset"
  >(null);
  const [detailsTxId, setDetailsTxId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SendDraft | null>(null);
  const [menu, setMenu] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [backup, setBackup] = useState<null | "reveal" | "confirm" | "done">(null);
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const receiveRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
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
    setDepositError(null);
    receiveRef.current?.focus();
    window.setTimeout(async () => {
      const res = await fetch("/api/wallet/deposit", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDepositError(data?.error || "Could not receive.");
        return;
      }
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

  function exitBackup() {
    setBackup(null);
    window.setTimeout(() => gearRef.current?.focus(), 0);
  }

  async function completeBackup() {
    try {
      const res = await fetch("/api/wallet/backup", { method: "POST" });
      const data = (await res.json()) as { wallet?: WalletState; error?: string };
      if (!res.ok || !data.wallet) throw new Error(data.error || "Could not record backup.");
      walletRef.current = data.wallet;
      setWallet(data.wallet);
      setBackup("done");
    } catch {
      exitBackup();
    }
  }

  function closeMenu() {
    setMenu(false);
    gearRef.current?.focus();
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
  if (backup === "reveal") {
    return (
      <SeedReveal
        words={wallet.seedWords}
        onDone={() => setBackup("confirm")}
        onCancel={exitBackup}
      />
    );
  }
  if (backup === "confirm") {
    return (
      <SeedConfirm words={wallet.seedWords} onDone={completeBackup} onCancel={exitBackup} />
    );
  }
  if (backup === "done" && wallet.backupAt) {
    return <BackupDone backupAt={wallet.backupAt} onBack={exitBackup} />;
  }

  const incoming = wallet.history.filter((t) => t.direction === "in");
  const sawFirstConfirmation = incoming.some((t) => t.confirmations >= 1);
  const sawConfirmed = incoming.some((t) => t.status === "confirmed");
  const detailsTx = detailsTxId
    ? (wallet.history.find((t) => t.id === detailsTxId) ?? null)
    : null;

  function closeDetails() {
    const id = detailsTxId;
    setDetailsTxId(null);
    window.setTimeout(() => document.getElementById(`w-tx-${id}`)?.focus(), 0);
  }

  return (
    <div className="w-shell">
      <WalletTop onOpenSettings={() => setMenu(true)} gearRef={gearRef} />

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
        <button
          ref={sendRef}
          type="button"
          className="w-send-btn"
          onClick={() => setSheet("send")}
        >
          Send
        </button>
      </div>

      <h2 className="w-section-label">Activity</h2>
      {depositError ? (
        <p className="w-field-error" role="alert">
          {depositError}
        </p>
      ) : null}
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
              onOpen={setDetailsTxId}
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
      {detailsTx ? (
        <TxDetailsSheet
          tx={detailsTx}
          threshold={wallet.confirmedThreshold}
          onClose={closeDetails}
        />
      ) : null}
      {sheet === "send" ? (
        <SendSheet
          balance={wallet.balance}
          onClose={() => {
            setSheet(null);
            sendRef.current?.focus();
          }}
          onReview={(d) => {
            setDraft(d);
            setSheet("review");
          }}
        />
      ) : null}
      {menu ? (
        <SettingsMenu
          backupAt={wallet.backupAt}
          onClose={closeMenu}
          onBackup={() => {
            setMenu(false);
            setBackup("reveal");
          }}
          onRestore={() => {
            setMenu(false);
            setSheet("restore");
          }}
          onReset={() => {
            setMenu(false);
            setSheet("reset");
          }}
        />
      ) : null}
      {sheet === "restore" ? (
        <RestoreSheet
          onClose={() => {
            setSheet(null);
            gearRef.current?.focus();
          }}
        />
      ) : null}
      {sheet === "reset" ? (
        <ResetSheet
          onClose={() => {
            setSheet(null);
            gearRef.current?.focus();
          }}
          onReset={() => {
            setWallet(null);
            setSheet(null);
            setBackup(null);
            setMenu(false);
            setPhase("home");
          }}
        />
      ) : null}
      {sheet === "review" && draft ? (
        <ReviewSheet
          balance={wallet.balance}
          draft={draft}
          reduced={reduced}
          onCancel={() => {
            setSheet(null);
            setDraft(null);
            sendRef.current?.focus();
          }}
          onSent={(next, tx) => {
            walletRef.current = next;
            setArrivingId(tx.id);
            setWallet(next);
            setSheet(null);
            setDraft(null);
            sendRef.current?.focus();
            startTickLoop();
            window.setTimeout(() => {
              setArrivingId((id) => (id === tx.id ? null : id));
            }, 600);
          }}
        />
      ) : null}
    </div>
  );
}

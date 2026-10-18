"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";

export type RailStepState = "done" | "now" | "todo";

export type RailStep = {
  id: string;
  job: string;
  href: string;
  state: RailStepState;
};

type RailBodyProps = {
  driveLabel: string;
  stepLabel: string;
  steps: RailStep[];
  explorerUrl: string;
  onOpenWallet: (trigger: HTMLElement) => void;
};

function RailBody({ driveLabel, stepLabel, steps, explorerUrl, onOpenWallet }: RailBodyProps) {
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the current step visible inside the rail on mount. Container-local
  // scroll math only — the page itself must not move.
  useEffect(() => {
    const list = listRef.current;
    const scroller = list?.closest("[data-rail-scroll]") as HTMLElement | null;
    const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !scroller || !current) return;
    const r = scroller.getBoundingClientRect();
    const c = current.getBoundingClientRect();
    if (c.top < r.top) scroller.scrollTop -= r.top - c.top;
    else if (c.bottom > r.bottom) scroller.scrollTop += c.bottom - r.bottom;
  }, []);

  return (
    <>
      <p className="drive-rail-where">
        You&rsquo;re in: <span>{driveLabel}</span>
      </p>
      <ol ref={listRef} className="drive-route">
        {steps.map((s) => (
          <li key={s.id} data-state={s.state}>
            <Link
              href={s.href}
              aria-current={s.state === "now" ? "step" : undefined}
              className="drive-route-link"
              tabIndex={s.state === "now" ? -1 : undefined}
            >
              <span aria-hidden="true" className="drive-route-dot">
                {s.state === "done" ? "✓" : s.state === "now" ? "▶" : "○"}
              </span>
              <span>{s.job}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="drive-rail-count">{stepLabel}</p>
      <div className="drive-tools">
        <p className="drive-tools-title">TOOLS</p>
        <button type="button" onClick={(e) => onOpenWallet(e.currentTarget)}>
          Practice wallet
        </button>
        <Link href="/course">Course</Link>
        {/* Always rendered with a step-aware href: the slot never jumps. */}
        <a href={explorerUrl} target="_blank" rel="noreferrer">
          Mempool
        </a>
      </div>
    </>
  );
}

export function DriveRail(props: RailBodyProps) {
  return (
    <nav aria-label="Drive route" data-rail-scroll className="drive-rail">
      <RailBody {...props} />
    </nav>
  );
}

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>("a[href], button, input, textarea, select")].filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.tabIndex >= 0,
  );
}

export function RouteDrawer({
  open,
  onClose,
  triggerRef,
  ...rail
}: RailBodyProps & {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button")?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeTo(triggerRef, onClose);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const els = focusables(panelRef.current);
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
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;
  return (
    <div className="drive-drawer-veil" onClick={() => closeTo(triggerRef, onClose)}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Drive route"
        data-rail-scroll
        className="drive-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="drive-drawer-close" onClick={() => closeTo(triggerRef, onClose)}>
          Close route
        </button>
        <nav aria-label="Drive route">
          <RailBody {...rail} />
        </nav>
      </div>
    </div>
  );
}

function closeTo(triggerRef: RefObject<HTMLButtonElement | null>, onClose: () => void) {
  onClose();
  triggerRef.current?.focus();
}

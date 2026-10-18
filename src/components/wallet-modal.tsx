"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ExternalIcon } from "@/components/icons";
import { WalletApp } from "@/components/wallet-app";
import type { BitcoinNetwork } from "@/lib/bitcoin/provider";
import type { WalletState } from "@/lib/wallet";

/** Wallet sheets manage their own Escape; the modal must not close under one. */
const WALLET_SHEET_OPEN = ".w-overlay, .w-menu-overlay";

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>("a[href], button, input, textarea, select")].filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.tabIndex >= 0,
  );
}

export function WalletModal({
  open,
  onClose,
  triggerRef,
  network,
  esploraBase,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  network: BitcoinNetwork;
  esploraBase: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  // Floating position once dragged (null = veil-centered). position:fixed +
  // left/top only — never transform, which would re-anchor the wallet's own
  // fixed sheets.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  function onHeadPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || e.isPrimary === false) return;
    if (window.innerWidth <= 640) return; // bottom sheet on mobile: no drag
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    const panel = panelRef.current;
    const head = headRef.current;
    if (!panel || !head) return;
    const r = panel.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onHeadPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    const w = panel.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      left: Math.min(Math.max(e.clientX - d.dx, 120 - w), vw - 120),
      top: Math.min(Math.max(e.clientY - d.dy, 8), vh - 120),
    });
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector(WALLET_SHEET_OPEN)) return;
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
  // Portal to body: .stage-enter keeps a retained transform (fill: both),
  // which would re-anchor the fixed veil to the tall page instead of the
  // viewport. SSR-safe: open starts false, so server and first client render
  // agree on null.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="wallet-modal-veil" onClick={() => closeTo(triggerRef, onClose)}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Practice wallet"
        className="wallet-modal"
        style={
          pos
            ? {
                position: "fixed",
                left: pos.left,
                top: pos.top,
                margin: 0,
                // Pin inside the viewport AND the compact cap: content that
                // grows after a drag scrolls internally instead of
                // stranding buttons below the fold.
                maxHeight: `min(640px, calc(100dvh - ${Math.round(pos.top)}px - 16px))`,
                maxWidth: `calc(100vw - ${Math.round(pos.left)}px - 16px)`,
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={headRef}
          className="wallet-modal-head"
          data-dragging={dragging || undefined}
          onPointerDown={onHeadPointerDown}
          onPointerMove={onHeadPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <p className="wallet-modal-title">Practice wallet</p>
          <Link
            href="/wallet"
            target="_blank"
            rel="noreferrer"
            aria-label="Open wallet in a new tab"
            className="wallet-modal-popout"
          >
            <ExternalIcon />
          </Link>
          <button
            type="button"
            aria-label="Close wallet"
            className="wallet-modal-close"
            onClick={() => closeTo(triggerRef, onClose)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <WalletModalBody network={network} esploraBase={esploraBase} />
      </div>
    </div>,
    document.body,
  );
}

function WalletModalBody({
  network,
  esploraBase,
}: {
  network: BitcoinNetwork;
  esploraBase: string;
}) {
  // undefined = loading; null = no wallet yet (empty state inside WalletApp).
  const [initial, setInitial] = useState<WalletState | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fresh wallet on every open: the body mounts with the dialog, so mount =
  // open and no state reset is needed.
  useEffect(() => {
    let live = true;
    fetch("/api/wallet")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load the wallet.");
        return res.json() as Promise<{ wallet: WalletState | null }>;
      })
      .then((data) => {
        if (live) setInitial(data.wallet ?? null);
      })
      .catch((e: unknown) => {
        if (live) setLoadError(e instanceof Error ? e.message : "Could not load the wallet.");
      });
    return () => {
      live = false;
    };
  }, []);

  if (loadError) {
    return (
      <div className="wallet-modal-state">
        <p role="alert">{loadError}</p>
        <p>
          <Link href="/wallet">Open the full wallet page instead.</Link>
        </p>
      </div>
    );
  }
  if (initial === undefined) {
    return (
      <p className="wallet-modal-state" role="status">
        Loading wallet…
      </p>
    );
  }
  return <WalletApp initial={initial} network={network} esploraBase={esploraBase} bare />;
}

function closeTo(triggerRef: RefObject<HTMLElement | null>, onClose: () => void) {
  onClose();
  triggerRef.current?.focus();
}

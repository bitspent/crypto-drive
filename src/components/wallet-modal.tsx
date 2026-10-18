"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wallet-modal-head">
          <p className="wallet-modal-title">Practice wallet</p>
          <Link href="/wallet" className="wallet-modal-full">
            Open full page
          </Link>
          <button
            type="button"
            className="wallet-modal-close"
            onClick={() => closeTo(triggerRef, onClose)}
          >
            Close wallet
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
  return <WalletApp initial={initial} network={network} esploraBase={esploraBase} />;
}

function closeTo(triggerRef: RefObject<HTMLElement | null>, onClose: () => void) {
  onClose();
  triggerRef.current?.focus();
}

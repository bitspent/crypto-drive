"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  /** Short name for aria, e.g. "Bitcoin address" */
  label?: string;
  className?: string;
  /** Controlled copied state (lesson gates). Uncontrolled resets after 2s. */
  copied?: boolean;
  onCopiedChange?: (copied: boolean) => void;
};

export function CopyChip({
  value,
  label = "value",
  className,
  copied: controlled,
  onCopiedChange,
}: Props) {
  const [internal, setInternal] = useState(false);
  const copied = controlled ?? internal;

  function copy() {
    void navigator.clipboard?.writeText(value).catch(() => undefined);
    if (controlled === undefined) {
      setInternal(true);
      window.setTimeout(() => setInternal(false), 2000);
    } else {
      onCopiedChange?.(true);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-150",
        "border-[var(--lane)] bg-[var(--cabin)] hover:border-[var(--amber)]/60 hover:bg-[var(--amber)]/10",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)]",
        copied && "border-[var(--go)]/60 bg-[var(--go)]/10 hover:border-[var(--go)]/60 hover:bg-[var(--go)]/10",
        className,
      )}
      aria-label={copied ? `${label} copied to clipboard` : `Copy ${label}`}
    >
      <span className="min-w-0 flex-1 break-all font-mono text-sm leading-snug text-[var(--paper)]">
        {value}
      </span>
      <span
        className={cn(
          "mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] leading-none",
          copied
            ? "border-[var(--go)]/50 bg-[var(--go)]/15 text-[var(--go)]"
            : "border-[var(--amber)]/45 bg-[var(--amber)]/10 text-[var(--amber)]",
        )}
        aria-live="polite"
      >
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

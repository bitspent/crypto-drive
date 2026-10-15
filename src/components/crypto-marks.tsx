import { cn } from "@/lib/utils";

type MarkProps = {
  className?: string;
  title?: string;
};

export function BtcMark({ className, title = "Bitcoin" }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8", className)}
      aria-label={title}
      role="img"
    >
      <circle cx="16" cy="16" r="15" fill="var(--btc)" />
      <path
        fill="var(--on-btc)"
        d="M18.2 14.1c.9-.5 1.4-1.2 1.3-2.3-.2-1.5-1.5-2-3.1-2.2V7.5h-1.5v2h-1.2V7.5h-1.5v2H9.5v1.6h1.1c.6 0 .8.3.8.8v7.3c0 .4-.2.7-.7.7H9.4v1.6h2.7v2.1h1.5v-2.1h1.2v2.1h1.5v-2.1c2.1-.1 3.6-.9 3.8-2.8.1-1.3-.5-2.1-1.6-2.5zm-4.3-2.8h1.6c.9 0 1.5.3 1.6 1.1.1.8-.4 1.2-1.5 1.2h-1.7V11.3zm1.8 7.6h-1.8v-2.5h1.9c1.1 0 1.7.4 1.7 1.3 0 .9-.6 1.2-1.8 1.2z"
      />
    </svg>
  );
}

export function WalletMark({ className, title = "Wallet" }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-label={title} role="img">
      <rect x="3" y="8" width="26" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 13h26" stroke="currentColor" strokeWidth="2" />
      <circle cx="23" cy="19" r="2" fill="var(--amber)" />
    </svg>
  );
}

export function KeyMark({ className, title = "Private key" }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-label={title} role="img">
      <circle cx="11" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15 15l10 10M21 21l3-1M19 23l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function QrMark({ className, title = "QR" }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-label={title} role="img">
      <rect x="4" y="4" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="18" y="4" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="18" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M18 18h4v4h-4zm6 0h4v4h-4zm-6 6h4v4h-4zm6 2h2v2h-2zm4-2h2v4h-4v-2" fill="currentColor" />
    </svg>
  );
}

export function ExplorerMark({ className, title = "Explorer" }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-label={title} role="img">
      <circle cx="14" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l7 7" stroke="var(--amber)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 14h8M14 10v8" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

export function EthMark({ className, title = "Ethereum" }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-label={title} role="img">
      <path fill="currentColor" d="M16 3l-7 12 7 4 7-4-7-12zm0 26l7-10-7 4-7-4 7 10z" opacity="0.9" />
    </svg>
  );
}

export function SolMark({ className, title = "Solana" }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-label={title} role="img">
      <path fill="#9945FF" d="M7 8h14.5L25 11.2H11.2L7 8z" />
      <path fill="#14F195" d="M7 14.2h14.5l3.5 3.2H11.2L7 14.2z" />
      <path fill="#9945FF" d="M11.2 20.4H25L21.5 24H7l4.2-3.6z" />
    </svg>
  );
}

export function TrxMark({ className, title = "Tron" }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-label={title} role="img">
      <circle cx="16" cy="16" r="15" fill="#ef0027" />
      <path fill="#fff" d="M9 11.5h13.2L16 23.5 9 11.5z" />
      <path fill="#ef0027" d="M12.2 13.2 16 19.4l3.6-6.2H12.2z" />
    </svg>
  );
}

export function TrackSymbol({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  switch (symbol) {
    case "btc":
      return <BtcMark className={className} />;
    case "eth":
      return <EthMark className={className} />;
    case "usdt":
      return (
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--go)]/20 font-[family-name:var(--font-display)] text-xs font-bold text-[var(--go)]",
            className,
          )}
        >
          ₮
        </span>
      );
    case "sol":
      return <SolMark className={className} />;
    case "trx":
      return <TrxMark className={className} />;
    default:
      return <WalletMark className={className} />;
  }
}

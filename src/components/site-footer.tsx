import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--lane)]/70 px-5 py-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 text-sm text-[var(--mute)] sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Legal" className="flex items-center gap-5">
          <Link href="/terms" className="hover:text-[var(--amber)] transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[var(--amber)] transition-colors">
            Privacy
          </Link>
          <Link href="/refund" className="hover:text-[var(--amber)] transition-colors">
            Refund
          </Link>
        </nav>
        <p>© {year} Crypto Drive · Education, not financial advice.</p>
      </div>
    </footer>
  );
}

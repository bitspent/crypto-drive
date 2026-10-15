import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="relative z-20 flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
      <Link
        href="/"
        className="font-[family-name:var(--font-display)] text-lg tracking-[0.08em] text-[var(--paper)] sm:text-xl"
      >
        CRYPTO DRIVE
      </Link>
      <nav className="flex items-center gap-3 text-sm text-[var(--fog)] sm:gap-4">
        <Link href="/course" className="hidden hover:text-[var(--amber)] transition-colors xs:inline sm:inline">
          Course
        </Link>
        <Link href="/unlock" className="hover:text-[var(--amber)] transition-colors">
          Unlock
        </Link>
        <a
          href={process.env.NEXT_PUBLIC_GUMROAD_URL || "https://gumroad.com/l/crypto-drive"}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden hover:text-[var(--amber)] transition-colors sm:inline"
        >
          Gumroad
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}

import Link from "next/link";
import { ChainTiles } from "@/components/chain-tiles";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

const gumroadUrl =
  process.env.NEXT_PUBLIC_GUMROAD_URL || "https://gumroad.com/l/crypto-drive";

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 road-vanishing opacity-90"
      />
      <SiteHeader />

      <main className="relative z-10 flex flex-1 flex-col justify-center px-5 pb-16 pt-6 sm:px-8 sm:pb-24">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:gap-14">
          <div>
            <p className="animate-rise font-[family-name:var(--font-display)] text-5xl leading-none tracking-[0.06em] text-[var(--paper)] sm:text-7xl md:text-8xl">
              CRYPTO DRIVE
            </p>
            <div className="lane-accent mt-5 h-0.5 w-40 bg-[var(--amber)] sm:w-56" />

            <h1 className="animate-rise-delay mt-8 max-w-2xl font-[family-name:var(--font-display)] text-2xl leading-tight text-[var(--paper)] sm:text-4xl">
              Regulation is coming. Don’t wait to learn how to drive.
            </h1>

            <p className="animate-rise-delay-2 mt-5 max-w-xl text-base leading-relaxed text-[var(--fog)] sm:text-lg">
              Bitcoin first — what it is, then how to drive it. Receive a practice
              payment, prove it arrived, send a little, and guard the keys. One
              screen at a time. Your license gets its own drills.
            </p>

            <div className="animate-rise-delay-2 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href={gumroadUrl} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="cta-glow w-full sm:w-auto">
                  Get the course on Gumroad
                </Button>
              </a>
              <Link href="/unlock">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  I have a license
                </Button>
              </Link>
            </div>
          </div>

          <div className="animate-rise-delay-2">
            <ChainTiles />
          </div>
        </div>
      </main>

      <section className="relative z-10 border-t border-[var(--lane)]/70 px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.16em] text-[var(--amber)]">
              BITCOIN TRACK
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--fog)]">
              Five stops, play money, about 35 minutes. Meet the protocol, then
              receive, prove it landed, send a tiny test, and guard the keys.
            </p>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.16em] text-[var(--amber)]">
              PROOF YOU PASSED
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--fog)]">
              Finish the road test on Certified and get one certificate with a
              public verify link you can share.
            </p>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.16em] text-[var(--amber)]">
              GUMROAD ACCESS
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--fog)]">
              Buy a tier on Gumroad, unlock here with your license. Ethereum,
              USDT, Tron, and Solana come next — Bitcoin ships first.
            </p>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}

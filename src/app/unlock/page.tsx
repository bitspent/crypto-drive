import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { UnlockCounter } from "@/components/unlock-counter";
import { getAllTiers } from "@/lib/content";

export const metadata: Metadata = {
  title: "Unlock",
};

// The demo-key hint must reflect the server that serves the page, not the
// machine that built it: ALLOW_DEMO_LICENSES is a runtime fact, so the
// gate cannot be a static prerender.
export const dynamic = "force-dynamic";

export default async function UnlockPage() {
  const tiers = await getAllTiers();
  // Mirror the acceptance condition in src/lib/license.ts: demo keys only
  // work outside production, or with ALLOW_DEMO_LICENSES=1.
  const demoHint =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEMO_LICENSES === "1";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-12 sm:px-8">
        <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
          THE LICENSE COUNTER
        </p>
        <h1 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-5xl">
          Enter your key. Get behind the wheel.
        </h1>
        <p className="mt-4 max-w-lg text-[var(--fog)]">
          Use the license from your Gumroad purchase. Your key maps to a tier —
          Starter, Certified, or VIP — and unlocks that path in the app.
        </p>
        <div className="mt-10">
          <UnlockCounter
            classes={tiers.map((tier) => ({
              id: tier.id,
              name: tier.name,
              shortName: tier.shortName,
              priceBand: tier.priceBand,
              recommended: tier.recommended,
              whoFor: tier.whoFor,
            }))}
            demoHint={demoHint}
          />
        </div>
        <p className="mt-8 text-sm text-[var(--mute)]">
          No license yet?{" "}
          <a
            href={
              process.env.NEXT_PUBLIC_GUMROAD_URL ||
              "https://gumroad.com/l/crypto-drive"
            }
            className="text-[var(--amber)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get the course on Gumroad
          </a>
          {" · "}
          <Link href="/" className="hover:text-[var(--paper)]">
            Back home
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

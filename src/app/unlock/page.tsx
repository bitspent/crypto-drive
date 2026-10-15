import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { UnlockForm } from "@/components/unlock-form";

export const metadata: Metadata = {
  title: "Unlock",
};

export default function UnlockPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-12 sm:px-8">
        <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
          LICENSE UNLOCK
        </p>
        <h1 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-5xl">
          Enter your key. Get behind the wheel.
        </h1>
        <p className="mt-4 max-w-lg text-[var(--fog)]">
          Use the license from your Gumroad purchase. Your key maps to a tier —
          Starter, Certified, or VIP — and unlocks that path in the app.
        </p>
        <div className="mt-10">
          <UnlockForm />
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
    </div>
  );
}

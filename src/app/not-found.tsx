import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
          404
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-4xl">
          That route isn’t on the map.
        </h1>
        <p className="mt-4 text-[var(--fog)]">
          If you were looking for a certificate, double-check the verify ID.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button>Back to Crypto Drive</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

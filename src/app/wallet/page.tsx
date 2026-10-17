import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { WalletApp } from "@/components/wallet-app";
import { getBitcoinProvider } from "@/lib/bitcoin";
import type { BitcoinNetwork } from "@/lib/bitcoin/provider";
import { getSessionId } from "@/lib/session";
import { getStudentBySession, getWalletForSession } from "@/lib/store";

export const metadata: Metadata = {
  title: "Practice wallet",
};

export default async function WalletPage() {
  const sessionId = await getSessionId();
  const student = await getStudentBySession(sessionId);
  if (!student) redirect("/unlock");

  const wallet = await getWalletForSession(sessionId ?? undefined);
  // Drives the explorer link in tx details. A misconfigured regtest backend
  // must not 500 the page — the wallet routes surface that error themselves.
  let network: BitcoinNetwork = "simulated";
  try {
    network = getBitcoinProvider().network;
  } catch {
    network = "simulated";
  }
  // Runtime server env (boot.sh sets it to our jumped UI port) — never a
  // NEXT_PUBLIC_* bake, so no rebuild is needed when the port moves.
  const esploraBase = process.env.ESPLORA_PUBLIC_URL?.trim() || "http://localhost:5000";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-10 pt-0 sm:px-8 sm:pb-14">
        <WalletApp initial={wallet} network={network} esploraBase={esploraBase} />
      </main>
    </div>
  );
}

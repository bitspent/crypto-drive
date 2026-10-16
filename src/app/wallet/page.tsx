import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { WalletApp } from "@/components/wallet-app";
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

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-10 pt-0 sm:px-8 sm:pb-14">
        <WalletApp initial={wallet} />
      </main>
    </div>
  );
}

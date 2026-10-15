import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getAppUrl } from "@/lib/share";
import { getCertificate } from "@/lib/store";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cert = await getCertificate(id);
  if (!cert) {
    return { title: "Certificate not found" };
  }
  const appUrl = getAppUrl();
  return {
    title: `Verify · ${cert.studentName}`,
    description: `Off-chain attestation that ${cert.studentName} completed ${cert.module}.`,
    openGraph: {
      title: `Crypto Drive certificate — ${cert.studentName}`,
      description: cert.module,
      images: [`${appUrl}/api/og?id=${encodeURIComponent(cert.id)}`],
    },
  };
}

export default async function VerifyPage({ params }: Props) {
  const { id } = await params;
  const cert = await getCertificate(id);
  if (!cert) notFound();

  const appUrl = getAppUrl();
  const ogUrl = `${appUrl}/api/og?id=${encodeURIComponent(cert.id)}`;
  const issued = new Date(cert.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--go)]">
          VERIFIED ATTESTATION
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-4xl">
          {cert.studentName}
        </h1>
        <p className="mt-4 text-[var(--fog)]">
          This public page confirms an off-chain Crypto Drive certificate. No
          NFT required — the hash below is the attestation.
        </p>

        <dl className="mt-8 grid gap-4 rounded-xl border border-[var(--lane)] bg-[var(--cabin)] p-5 sm:p-6">
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--mute)]">Module</dt>
            <dd className="mt-1 text-[var(--paper)]">{cert.module}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--mute)]">Milestone</dt>
            <dd className="mt-1 text-[var(--paper)]">{cert.milestone}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--mute)]">Issued</dt>
            <dd className="mt-1 text-[var(--paper)]">{issued}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--mute)]">Certificate ID</dt>
            <dd className="mt-1 font-mono text-sm text-[var(--amber)]">{cert.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--mute)]">Attestation hash</dt>
            <dd className="mt-1 font-mono text-sm text-[var(--paper)]">{cert.hash}</dd>
          </div>
        </dl>

        <div className="mt-8 overflow-hidden rounded-xl border border-[var(--lane)]">
          <Image
            src={ogUrl}
            alt={`Certificate for ${cert.studentName}`}
            width={1200}
            height={630}
            className="h-auto w-full"
            unoptimized
            priority
          />
        </div>

        <p className="mt-10 text-sm text-[var(--mute)]">
          <Link href="/" className="text-[var(--amber)] hover:underline">
            Crypto Drive
          </Link>{" "}
          — learn wallet skills like learning to drive.
        </p>
      </main>
    </div>
  );
}

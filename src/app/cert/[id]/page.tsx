import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/share-buttons";
import { SiteHeader } from "@/components/site-header";
import { getAppUrl } from "@/lib/share";
import { getCertificate } from "@/lib/store";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cert = await getCertificate(id);
  if (!cert) return { title: "Certificate" };
  return {
    title: `${cert.studentName} · Certificate`,
    description: `Crypto Drive certificate for ${cert.studentName}: ${cert.module}`,
  };
}

export default async function CertPage({ params }: Props) {
  const { id } = await params;
  const cert = await getCertificate(id);
  if (!cert) notFound();

  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify/${cert.id}`;
  const ogUrl = `${appUrl}/api/og?id=${encodeURIComponent(cert.id)}`;
  const issued = new Date(cert.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
          YOU PASSED
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-5xl">
          Certificate ready, {cert.studentName.split(" ")[0]}.
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--fog)]">
          {cert.module} — {cert.milestone}. Issued {issued}. Share the verify
          link so anyone can check it.
        </p>

        <div className="mt-10 overflow-hidden rounded-xl border border-[var(--lane)] bg-[var(--cabin)]">
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

        <div className="mt-8 space-y-3">
          <p className="text-sm text-[var(--mute)]">
            Public verify URL:{" "}
            <Link href={`/verify/${cert.id}`} className="text-[var(--amber)] break-all">
              {verifyUrl}
            </Link>
          </p>
          <p className="font-mono text-xs text-[var(--mute)]">Hash {cert.hash}</p>
        </div>

        <div className="mt-8">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm tracking-[0.16em] text-[var(--amber)]">
            SHARE IT
          </h2>
          <ShareButtons studentName={cert.studentName} verifyUrl={verifyUrl} />
        </div>

        <div className="mt-12 flex flex-wrap gap-4 text-sm text-[var(--mute)]">
          <Link href="/track/bitcoin" className="hover:text-[var(--amber)]">
            Bitcoin track
          </Link>
          <Link href="/course" className="hover:text-[var(--amber)]">
            Course
          </Link>
          <Link href="/" className="hover:text-[var(--amber)]">
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}

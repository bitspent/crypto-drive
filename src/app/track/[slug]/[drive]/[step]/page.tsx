import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DriveStep } from "@/components/drive-step";
import { SiteHeader } from "@/components/site-header";
import { getBitcoinProvider } from "@/lib/bitcoin";
import type { BitcoinNetwork } from "@/lib/bitcoin/provider";
import { getTier, getTrack } from "@/lib/content";
import {
  findStepBySlug,
  followingHref,
  previousHref,
  resumeHref,
  stepBlockedReason,
} from "@/lib/drive";
import { getSessionId } from "@/lib/session";
import {
  ensureExamStartedAt,
  getPracticeForSession,
  getStudentBySession,
  getTrackCertificate,
} from "@/lib/store";

type Props = {
  params: Promise<{ slug: string; drive: string; step: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, drive: driveSlug, step: stepSlug } = await params;
  const track = await getTrack(slug);
  const found = track?.drives
    ? findStepBySlug(track.drives, driveSlug, stepSlug)
    : null;
  if (!found) return { title: "Drive" };
  return { title: `${found.drive.title} — ${found.step.job}` };
}

export default async function DriveStepPage({ params }: Props) {
  const { slug, drive: driveSlug, step: stepSlug } = await params;
  const sessionId = await getSessionId();
  const student = await getStudentBySession(sessionId);
  if (!student) redirect("/unlock");

  const track = await getTrack(slug);
  if (!track?.drives?.length) notFound();

  const tier = await getTier(student.tier);
  if (!tier.tracks.includes(track.slug) || track.status !== "ready") notFound();

  const found = findStepBySlug(track.drives, driveSlug, stepSlug);
  if (!found) notFound();

  const blocked = stepBlockedReason(track.drives, found.step.id, student.modulesPassed);
  if (blocked) {
    redirect(resumeHref(track.slug, track.drives, student.modulesPassed) ?? `/track/${track.slug}`);
  }

  const existingCert = found.step.cert
    ? await getTrackCertificate(student.id, track.slug, found.step.id)
    : null;

  const practice = await getPracticeForSession(sessionId ?? undefined);
  if (!practice) redirect("/unlock");

  // Drives the final exam (prove-it/exam): task proofs differ per backend,
  // and the read-back links at the runtime Esplora URL. A misconfigured
  // backend must not 500 the page — the exam scene surfaces it instead.
  let network: BitcoinNetwork = "simulated";
  try {
    network = getBitcoinProvider().network;
  } catch {
    network = "simulated";
  }
  const esploraBase = process.env.ESPLORA_PUBLIC_URL?.trim() || "http://localhost:5000";

  // Exam attempt binding: the marker is set once, on first exam load. Only
  // evidence from at-or-after it counts toward the certificate.
  const examSince =
    found.step.action.type === "wallet-exam"
      ? await ensureExamStartedAt(student.id)
      : null;

  // Rail route: every step in this drive with done/now/todo from passes.
  const route = found.drive.steps.map((s) => ({
    id: s.id,
    job: s.job,
    href: `/track/${track.slug}/${found.drive.slug}/${s.slug}`,
    state: (
      s.id === found.step.id ? "now" : student.modulesPassed[s.id] ? "done" : "todo"
    ) as "done" | "now" | "todo",
  }));

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-10 pt-0 sm:px-8 sm:pb-14">
        <div className="mb-3">
          <Link href={`/track/${track.slug}`} className="text-sm text-[var(--mute)] hover:text-[var(--amber)]">
            ← {track.title} road
          </Link>
        </div>
        <DriveStep
          step={found.step}
          trackSlug={track.slug}
          driveSlug={found.drive.slug}
          practice={practice}
          nextHref={followingHref(track.slug, track.drives, found.step.id)}
          prevHref={previousHref(track.slug, track.drives, found.step.id)}
          alreadyPassed={Boolean(student.modulesPassed[found.step.id])}
          canCertify={tier.features.certificate && tier.features.verifyLink}
          existingCertId={existingCert?.id ?? null}
          trackTitle={track.title}
          driveTitle={found.drive.title}
          driveOutcome={found.drive.outcome}
          driveIndex={found.driveIndex}
          driveCount={track.drives.length}
          stepIndex={found.stepIndex}
          stepCount={found.drive.steps.length}
          network={network}
          esploraBase={esploraBase}
          route={route}
          examSince={examSince}
        />
      </main>
    </div>
  );
}

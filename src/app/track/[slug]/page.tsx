import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { TrackSymbol } from "@/components/crypto-marks";
import { RoadMap } from "@/components/road-map";
import { getTrack, getTier } from "@/lib/content";
import {
  countFinishedDrives,
  resumeHref,
} from "@/lib/drive";
import { getSessionId } from "@/lib/session";
import { getStudentBySession } from "@/lib/store";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const track = await getTrack(slug);
  if (!track) return { title: "Track" };
  return { title: `${track.title} track` };
}

export default async function TrackPage({ params }: Props) {
  const { slug } = await params;
  const sessionId = await getSessionId();
  const student = await getStudentBySession(sessionId);

  if (!student) {
    redirect("/unlock");
  }

  const track = await getTrack(slug);
  if (!track) notFound();

  const tier = await getTier(student.tier);
  if (!tier.tracks.includes(track.slug)) {
    notFound();
  }

  if (track.status === "coming") {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
          <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
            {track.eyebrow} · COMING NEXT
          </p>
          <div className="mt-4 flex items-center gap-3">
            <TrackSymbol symbol={track.symbol} />
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--paper)]">
              {track.headline}
            </h1>
          </div>
          <p className="mt-4 text-[var(--fog)]">{track.summary}</p>
          <ul className="mt-8 space-y-2">
            {(track.comingBeats ?? []).map((beat) => (
              <li key={beat} className="coach-cue text-[var(--fog)]">
                {beat}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-[var(--mute)]">
            Not charge-ready yet. Finish the Bitcoin first drive — that’s the road built to teaching quality.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/track/bitcoin">
              <Button>Open Bitcoin</Button>
            </Link>
            <Link href="/course">
              <Button variant="secondary">Back to course</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const drives = track.drives ?? [];
  const done = countFinishedDrives(drives, student.modulesPassed);
  const resume = resumeHref(track.slug, drives, student.modulesPassed);
  const minutes = drives.reduce((sum, d) => {
    const m = /(\d+)\s*min/.exec(d.minutes ?? "");
    return sum + (m ? Number(m[1]) : 0);
  }, 0);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
              {track.eyebrow} · {tier.shortName.toUpperCase()}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <TrackSymbol symbol={track.symbol} className="h-10 w-10" />
              <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-4xl">
                {track.headline}
              </h1>
            </div>
            <p className="mt-3 max-w-2xl text-[var(--fog)]">{track.coachPitch}</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              Play money. About {minutes > 0 ? minutes : 35} minutes. {done} / {drives.length}{" "}
              stops done.
            </p>
          </div>
          <Link href="/course" className="text-sm text-[var(--mute)] hover:text-[var(--amber)]">
            All tracks
          </Link>
        </div>

        {resume ? (
          <div className="mb-8">
            <Link href={resume}>
              <Button size="lg" className="cta-glow">
                {done === 0 ? "Start the drive" : "Continue"}
              </Button>
            </Link>
          </div>
        ) : (
          <p className="mb-8 text-sm text-[var(--go)]">You finished this drive.</p>
        )}

        <RoadMap
          trackSlug={track.slug}
          drives={drives}
          passed={student.modulesPassed}
        />
      </main>
    </div>
  );
}

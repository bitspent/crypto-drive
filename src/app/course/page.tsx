import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { TrackSymbol } from "@/components/crypto-marks";
import { getTracksForTier, getTier } from "@/lib/content";
import { countFinishedDrives, resumeHref } from "@/lib/drive";
import { getSessionId } from "@/lib/session";
import { getStudentBySession } from "@/lib/store";

export const metadata: Metadata = {
  title: "Your course",
};

export default async function CoursePage() {
  const sessionId = await getSessionId();
  const student = await getStudentBySession(sessionId);

  if (!student) {
    redirect("/unlock");
  }

  const tier = await getTier(student.tier);
  const tracks = await getTracksForTier(tier);
  const callUrl = process.env.NEXT_PUBLIC_VIP_CALL_URL;
  const qaUrl = process.env.NEXT_PUBLIC_VIP_QA_URL;

  const btc = tracks.find((t) => t.slug === "bitcoin");
  const btcDrives = btc?.drives ?? [];
  const btcDone = countFinishedDrives(btcDrives, student.modulesPassed);
  const btcResume = btc
    ? resumeHref(btc.slug, btcDrives, student.modulesPassed)
    : null;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
              {tier.shortName.toUpperCase()} TIER
              {tier.recommended ? " · RECOMMENDED" : ""}
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-4xl">
              {tier.name}
            </h1>
            <p className="mt-3 max-w-2xl text-[var(--fog)]">{tier.coachPitch}</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              Signed in as {student.email}
            </p>
          </div>
          <Link
            href="/unlock"
            className="text-sm text-[var(--mute)] hover:text-[var(--amber)]"
          >
            Switch license
          </Link>
        </div>

        {tier.features.liveCall && tier.support ? (
          <section className="mb-10 grid gap-4 rounded-2xl border border-[var(--amber)]/40 bg-[var(--cabin)] p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.16em] text-[var(--amber)]">
                {tier.support.callLabel.toUpperCase()}
              </h2>
              <p className="mt-2 text-sm text-[var(--fog)]">
                {tier.support.callHint}
              </p>
              {callUrl ? (
                <a
                  href={callUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block"
                >
                  <Button size="sm">Schedule call</Button>
                </a>
              ) : (
                <p className="mt-4 text-sm text-[var(--mute)]">
                  Scheduling link goes live with Gumroad fulfillment.
                </p>
              )}
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.16em] text-[var(--amber)]">
                {tier.support.qaLabel.toUpperCase()}
              </h2>
              <p className="mt-2 text-sm text-[var(--fog)]">
                {tier.support.qaHint}
              </p>
              {qaUrl ? (
                <a href={qaUrl} className="mt-4 inline-block">
                  <Button size="sm" variant="secondary">
                    Open Q&A
                  </Button>
                </a>
              ) : (
                <p className="mt-4 text-sm text-[var(--mute)]">
                  Private Q&A lane opens after purchase.
                </p>
              )}
            </div>
          </section>
        ) : null}

        <p className="mb-8 rounded-xl border border-[var(--lane)] bg-[var(--cabin)] px-4 py-3 text-sm text-[var(--fog)]">
          Bitcoin first drive:{" "}
          <span className="text-[var(--paper)]">
            {btcDone} / {btcDrives.length} stops.
          </span>{" "}
          {tier.features.certificate && tier.features.verifyLink
            ? "Finish the road test to earn one verify link."
            : `You can practice every stop. The verify link is Certified. ${tier.upgradeHint ?? ""}`}
        </p>

        <Link
          href="/wallet"
          className="group mb-10 flex items-center justify-between gap-4 rounded-2xl border border-[var(--lane)] bg-[var(--cabin)] p-5 transition-colors hover:border-[var(--amber)]/50"
        >
          <div>
            <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-[var(--amber)]">
              SANDBOX · PLAY MONEY
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl text-[var(--paper)] group-hover:text-[var(--amber)]">
              Your practice wallet
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--fog)]">
              Receive, send, back up, and restore simulated Bitcoin. Same address as your drives.
            </p>
          </div>
          <span aria-hidden="true" className="shrink-0 text-xl text-[var(--mute)] group-hover:text-[var(--amber)]">
            →
          </span>
        </Link>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.16em] text-[var(--amber)]">
            YOUR PATH
          </h2>
          {btc?.status === "ready" ? (
            <Link href={btcResume ?? "/track/bitcoin"}>
              <Button size="sm">{btcResume ? "Continue Bitcoin →" : "Bitcoin road"}</Button>
            </Link>
          ) : null}
        </div>

        <ul className="stage-stagger space-y-4">
          {tracks.map((track, index) => {
            const ready = track.status === "ready";
            const href = ready ? `/track/${track.slug}` : undefined;
            const inner = (
              <>
                <div className="flex items-start gap-4">
                  <TrackSymbol symbol={track.symbol} className="mt-1 shrink-0" />
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-[var(--amber)]">
                      {track.eyebrow}
                      {!ready ? " · COMING NEXT" : ""}
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl text-[var(--paper)] group-hover:text-[var(--amber)]">
                      {track.title}
                    </h2>
                    <p className="mt-1 max-w-xl text-sm text-[var(--fog)]">
                      {track.summary}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-sm text-[var(--mute)]">
                  {ready ? (
                    <span>First drive</span>
                  ) : (
                    <span className="text-[var(--mute)]">Scaffold</span>
                  )}
                </div>
              </>
            );

            return (
              <li key={track.id} style={{ ["--i" as string]: index }}>
                {href ? (
                  <Link
                    href={href}
                    className="play-card group flex flex-col gap-3 rounded-2xl border border-[var(--lane)] bg-[var(--cabin)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex flex-col gap-3 rounded-2xl border border-[var(--lane)]/70 bg-[var(--cabin)]/70 p-5 opacity-80 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

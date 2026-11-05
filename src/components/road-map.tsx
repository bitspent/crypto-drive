import Link from "next/link";
import type { Drive } from "@/lib/content";
import { driveComplete, driveEntryHref, driveUnlocked } from "@/lib/drive";

/*
 * The track road: drives as route-shield stops on a single lane, the car
 * pinned to the stop the learner is driving, and a destination flag at
 * the end. Server-rendered; the shields and lane are decorative — the
 * card text carries the state for screen readers.
 */
export function RoadMap({
  trackSlug,
  drives,
  passed,
}: {
  trackSlug: string;
  drives: Drive[];
  passed: Record<string, string>;
}) {
  // The stop the learner is driving: the first unlocked drive with an
  // open screen. Null once every stop is passed.
  let hereId: string | null = null;
  for (let i = 0; i < drives.length; i++) {
    if (!driveUnlocked(drives, i, passed)) break;
    if (!driveComplete(drives[i], passed)) {
      hereId = drives[i].id;
      break;
    }
  }
  const finished =
    drives.length > 0 && drives.every((drive) => driveComplete(drive, passed));

  return (
    <div className="road-scene" data-testid="road-map">
      <div className="road-head" aria-hidden="true">
        <span className="road-head-line" />
        <span className="road-head-label">Start</span>
      </div>
      <ol className="road-map stage-stagger" aria-label="Drive stops on the road">
        {drives.map((drive, index) => {
          const unlocked = driveUnlocked(drives, index, passed);
          const complete = driveComplete(drive, passed);
          const here = drive.id === hereId;
          const state = complete ? "done" : here ? "here" : unlocked ? "open" : "locked";

          const card = (
            <>
              <div className="road-card-top">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--paper)]">
                  {drive.title}
                </h2>
                <p className="road-card-state">
                  {complete ? (
                    <span className="text-[var(--go)]">Done</span>
                  ) : unlocked ? (
                    <span>{drive.minutes}</span>
                  ) : (
                    <span>Locked</span>
                  )}
                </p>
              </div>
              <p className="mt-1 text-sm text-[var(--fog)]">{drive.job}</p>
            </>
          );

          return (
            <li
              key={drive.id}
              className="road-stop"
              data-state={state}
              style={{ ["--i" as string]: index }}
            >
              <span className="road-marker" aria-hidden="true">
                <span className="road-shield">
                  {complete ? "✓" : index + 1}
                </span>
                {here ? (
                  <span className="road-you" data-testid="road-you">
                    You are here
                  </span>
                ) : null}
              </span>
              {unlocked ? (
                <Link
                  href={driveEntryHref(trackSlug, drive, passed)}
                  className="road-card play-card"
                >
                  {card}
                </Link>
              ) : (
                <div className="road-card road-card-locked">{card}</div>
              )}
            </li>
          );
        })}
        <li className="road-finish" data-arrived={finished} aria-hidden="true">
          <span className="road-flag" />
          <span className="road-finish-label">
            {finished ? "You passed every stop" : "Destination: every stop passed"}
          </span>
        </li>
      </ol>
    </div>
  );
}

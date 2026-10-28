"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { TrackSymbol } from "@/components/crypto-marks";
import { cn } from "@/lib/utils";

export type ShelfTrack = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  status: string;
  symbol: string;
};

const MAX_SIDE = 2;

function placement(offset: number) {
  const o = Math.max(-MAX_SIDE - 1, Math.min(MAX_SIDE + 1, offset));
  const dist = Math.abs(o);
  return {
    // Pushed sideways, turned to face the reader, sunk back with distance.
    transform: `translateX(-50%) translateX(${o * 62}%) rotateY(${-o * 34}deg) translateZ(${-dist * 130}px) scale(${1 - dist * 0.07})`,
    opacity: dist > MAX_SIDE ? 0 : 1 - dist * 0.28,
    zIndex: 10 - dist,
    hidden: dist > MAX_SIDE,
  };
}

/** CSS-3D bookshelf carousel for the course track picker. No WebGL. */
export function TrackBookshelf({ tracks }: { tracks: ShelfTrack[] }) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      const n = tracks.length;
      setActive(((next % n) + n) % n);
    },
    [tracks.length],
  );

  return (
    <section
      aria-label="Course tracks. Use left and right arrows to browse."
      aria-roledescription="carousel"
      className="bookshelf"
      data-testid="track-bookshelf"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(active - 1);
        if (e.key === "ArrowRight") go(active + 1);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start == null) return;
        const end = e.changedTouches[0]?.clientX;
        if (end == null) return;
        const dx = end - start;
        if (dx > 40) go(active - 1);
        else if (dx < -40) go(active + 1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      tabIndex={0}
    >
      <div className="bookshelf-viewport" aria-live="off">
        {tracks.map((track, i) => {
          const offset = i - active;
          const p = placement(offset);
          const ready = track.status === "ready";
          const isActive = i === active;
          const book = (
            <>
              <span aria-hidden="true" className="bookshelf-spine" />
              <span className="flex items-start justify-between gap-2">
                <span className="font-[family-name:var(--font-display)] text-[10px] tracking-[0.18em] text-[var(--amber)]">
                  {track.eyebrow}
                </span>
                <TrackSymbol symbol={track.symbol} className="h-7 w-7 shrink-0" />
              </span>
              <span className="mt-2 block font-[family-name:var(--font-display)] text-xl leading-tight text-[var(--paper)]">
                {track.title}
              </span>
              <span className="mt-2 block line-clamp-4 text-sm leading-snug text-[var(--fog)]">
                {track.summary}
              </span>
              <span className="mt-auto block pt-3 text-xs text-[var(--mute)]">
                {ready ? (
                  <>First drive →</>
                ) : (
                  <>Scaffold · coming next</>
                )}
              </span>
            </>
          );
          const cls =
            "bookshelf-book group flex flex-col rounded-r-xl rounded-l-sm border border-[var(--lane)] bg-[var(--cabin)] p-5 text-left";
          return (
            <div
              key={track.slug}
              aria-hidden={!isActive && p.hidden ? true : undefined}
              aria-label={`${i + 1} of ${tracks.length}: ${track.title}`}
              aria-roledescription="slide"
              className={cn(cls, !ready && "bookshelf-coming")}
              data-active={isActive}
              data-testid={`shelf-book-${track.slug}`}
              style={{
                opacity: p.opacity,
                transform: p.transform,
                visibility: p.hidden ? "hidden" : "visible",
                zIndex: p.zIndex,
              }}
            >
              {ready ? (
                <Link
                  aria-label={`Open ${track.title}`}
                  className="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)]"
                  href={`/track/${track.slug}`}
                  tabIndex={p.hidden ? -1 : undefined}
                >
                  {book}
                </Link>
              ) : (
                <div aria-disabled="true" className="flex h-full flex-col">
                  {book}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bookshelf-controls">
        <button
          aria-label="Previous track"
          className="bookshelf-arrow"
          data-testid="shelf-prev"
          onClick={() => go(active - 1)}
          type="button"
        >
          ←
        </button>
        <div className="bookshelf-dots" role="tablist" aria-label="Choose a track">
          {tracks.map((track, i) => (
            <button
              key={track.slug}
              aria-current={i === active}
              aria-label={`Show ${track.title}`}
              className="bookshelf-dot"
              data-testid={`shelf-dot-${track.slug}`}
              onClick={() => go(i)}
              role="tab"
              type="button"
            />
          ))}
        </div>
        <button
          aria-label="Next track"
          className="bookshelf-arrow"
          data-testid="shelf-next"
          onClick={() => go(active + 1)}
          type="button"
        >
          →
        </button>
      </div>
      <p className="bookshelf-hint">Swipe, arrow, or tap a book to open it.</p>
    </section>
  );
}

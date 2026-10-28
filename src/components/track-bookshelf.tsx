"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrackSymbol } from "@/components/crypto-marks";
import type { TrackSealKind } from "@/lib/drive";
import { cn } from "@/lib/utils";

export type ShelfTrack = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  status: string;
  symbol: string;
  seal: { kind: TrackSealKind; label: string; pct: number };
};

/** Aged-leather dyes, one binding per track. */
const LEATHERS: Record<string, string> = {
  "money-map": "#7c5a2e",
  bitcoin: "#571f24",
  ethereum: "#26355c",
  "usdt-networks": "#1f4d3a",
  tron: "#6e1423",
  solana: "#3b2d4d",
};

const MAX_SIDE = 2;
/** Pixels of drag that shift the shelf by one book. */
const GLIDE_STEP = 140;

function placement(offset: number) {
  const o = Math.max(-MAX_SIDE - 1, Math.min(MAX_SIDE + 1, offset));
  const dist = Math.abs(o);
  return {
    // Pushed sideways, turned to face the reader, sunk back with distance.
    transform: `translateX(-50%) translateX(${o * 62}%) rotateY(${-o * 34}deg) rotateX(2deg) translateZ(${-dist * 130}px) scale(${1 - dist * 0.07})`,
    opacity: dist > MAX_SIDE ? 0 : 1 - dist * 0.28,
    zIndex: 10 - Math.round(dist),
    hidden: dist > MAX_SIDE,
  };
}

/** CSS-3D bookshelf carousel for the course track picker. No WebGL. */
export function TrackBookshelf({ tracks }: { tracks: ShelfTrack[] }) {
  const [active, setActive] = useState(0);
  /** Flattened, motion-free row: every book is perceivable, so expose all. */
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setCalm(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  /** Live drag offset in px, null when not gliding. */
  const [glide, setGlide] = useState<number | null>(null);
  const gliding = useRef(false);
  const glideStart = useRef(0);
  const glideDx = useRef(0);
  const suppressClick = useRef(false);

  const go = useCallback(
    (next: number) => {
      const n = tracks.length;
      setActive(((next % n) + n) % n);
    },
    [tracks.length],
  );

  const endGlide = useCallback(() => {
    // A clean tap must stay a tap: no state change, no transform jump.
    if (!gliding.current) return;
    gliding.current = false;
    const dx = glideDx.current;
    glideDx.current = 0;
    setGlide(null);
    if (dx <= -50) go(active + 1);
    else if (dx >= 50) go(active - 1);
    suppressClick.current = Math.abs(dx) > 8;
  }, [active, go]);

  return (
    <section
      aria-label="Course tracks. Drag, or use left and right arrows to browse."
      aria-roledescription="carousel"
      className="bookshelf select-none"
      data-testid="track-bookshelf"
      style={{ cursor: glide !== null ? "grabbing" : "grab" }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(active - 1);
        if (e.key === "ArrowRight") go(active + 1);
      }}
      onPointerCancel={() => {
        if (glide !== null) endGlide();
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        glideStart.current = e.clientX;
        glideDx.current = 0;
        gliding.current = true;
        const end = () => {
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
          endGlide();
        };
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
      }}
      onPointerMove={(e) => {
        if (!gliding.current || e.buttons === 0) return;
        const dx = e.clientX - glideStart.current;
        glideDx.current = dx;
        setGlide(dx);
      }}
      tabIndex={0}
    >
      <div className="bookshelf-viewport" aria-live="off">
        {tracks.map((track, i) => {
          const offset = i - active + (glide ?? 0) / GLIDE_STEP;
          const p = placement(offset);
          const ready = track.status === "ready";
          const isActive = i === active;
          const seal = track.seal;
          const footer = ready ? (
            <Link
              aria-label={`Open ${track.title} — first drive`}
              className="bookshelf-cta"
              href={`/track/${track.slug}`}
              onClick={(e) => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  e.preventDefault();
                }
              }}
              tabIndex={p.hidden && !calm ? -1 : undefined}
            >
              First drive <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span className="bookshelf-coming-label">Scaffold · coming next</span>
          );
          return (
            <div
              key={track.slug}
              aria-hidden={isActive || calm ? undefined : true}
              aria-label={`${i + 1} of ${tracks.length}: ${track.title}`}
              aria-roledescription="slide"
              className={cn(
                "bookshelf-book group flex flex-col rounded-r-lg rounded-l-sm p-5 text-left",
                !ready && "bookshelf-coming",
              )}
              data-active={isActive}
              data-testid={`shelf-book-${track.slug}`}
              style={{
                ["--leather" as string]: LEATHERS[track.slug] ?? "#4a3521",
                opacity: p.opacity,
                transform: p.transform,
                transition: glide !== null ? "none" : undefined,
                visibility: p.hidden ? "hidden" : "visible",
                zIndex: p.zIndex,
              }}
            >
              <span aria-hidden="true" className="bookshelf-spine" />
              <span aria-hidden="true" className="bookshelf-pages" />
              <span
                className={cn("bookshelf-stamp", `bookshelf-stamp-${seal.kind}`)}
                data-testid={`shelf-stamp-${track.slug}`}
              >
                {seal.label}
              </span>
              <span className="flex items-center gap-2 text-[#e8dcc0]">
                <TrackSymbol symbol={track.symbol} className="h-6 w-6 shrink-0" />
                <span className="font-[family-name:var(--font-display)] text-[10px] tracking-[0.22em] text-[#d8b45a]">
                  {track.eyebrow}
                </span>
              </span>
              <span className="mt-3 block font-[family-name:var(--font-display)] text-[1.7rem] leading-tight text-[#f0d9a0]">
                {track.title}
              </span>
              <span aria-hidden="true" className="bookshelf-rule" />
              <span className="mt-2 block line-clamp-4 text-sm leading-snug text-[#e6d9bd]/85">
                {track.summary}
              </span>
              <span className="mt-auto block pt-3">
                {seal.kind === "progress" || seal.kind === "done" ? (
                  <span aria-hidden="true" className="bookshelf-meter">
                    <span style={{ width: `${seal.pct}%` }} />
                  </span>
                ) : null}
                <span className="mt-3 block">{footer}</span>
              </span>
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
      <p className="bookshelf-hint">Drag, arrow, or tap First drive to open it.</p>
    </section>
  );
}

"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent as ReactSyntheticEvent,
} from "react";
import { TrackSymbol } from "@/components/crypto-marks";
import { cn } from "@/lib/utils";

export type ShelfTrack = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  status: string;
  symbol: string;
  seal: { kind: "done" | "progress" | "new" | "coming"; label: string; done: number; total: number; pct: number };
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

function statusText(track: ShelfTrack): string {
  const seal = track.seal;
  return seal.kind === "done"
    ? "done"
    : seal.kind === "progress"
      ? `in progress, ${seal.done} of ${seal.total}`
      : seal.kind === "new"
        ? "not opened"
        : "coming next";
}

function Tome({ track, style, active, hidden, onFocusBook, onHoverBook }: {
  track: ShelfTrack;
  style?: CSSProperties;
  active?: boolean;
  hidden?: boolean;
  onFocusBook?: () => void;
  onHoverBook?: (slug: string | null) => void;
}) {
  const ready = track.status === "ready";
  const seal = track.seal;
  return (
    <Link
      draggable={false}
      href={`/track/${track.slug}`}
      aria-label={`${track.title} — ${statusText(track)}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn("tome", !ready && "tome-coming")}
      data-testid={`shelf-book-${track.slug}`}
      data-active={active ? "true" : undefined}
      style={{ ["--leather" as string]: LEATHERS[track.slug] ?? "#4a3521", ...style }}
      onFocus={onFocusBook}
      onMouseEnter={() => onHoverBook?.(track.slug)}
      onMouseLeave={() => onHoverBook?.(null)}
    >
      <span aria-hidden="true" className="tome-spine" />
      <span aria-hidden="true" className="tome-pages" />
      <span className="tome-head">
        <TrackSymbol symbol={track.symbol} className="h-6 w-6 shrink-0" />
        <span className="tome-eyebrow">{track.eyebrow}</span>
      </span>
      <span className="tome-title">{track.title}</span>
      <span aria-hidden="true" className="tome-rule" />
      <span className="tome-summary">{track.summary}</span>
      <span aria-hidden="true" className={cn("tome-stamp", `tome-stamp-${seal.kind}`)} data-testid={`shelf-stamp-${track.slug}`}>
        {seal.label}
      </span>
      <span className="tome-foot">
        {seal.kind === "progress" || seal.kind === "done" ? (
          <span
            className="tome-meter"
            role="progressbar"
            aria-label={`${track.title} progress`}
            aria-valuemin={0}
            aria-valuemax={seal.total}
            aria-valuenow={seal.done}
          >
            <span style={{ width: `${seal.pct}%` }} />
          </span>
        ) : null}
        <span className="tome-cta">
          {ready ? (
            <>First drive <span aria-hidden="true">→</span></>
          ) : (
            <>Take a peek <span aria-hidden="true">→</span></>
          )}
        </span>
      </span>
    </Link>
  );
}

/**
 * Course library: leather volumes in a 3D glide slider inside one
 * single-light scene. Drag, arrows, dots or arrow keys browse; the
 * centred volume is the large one. Reduced motion gets the static shelf.
 */
export function TrackBookshelf({ tracks }: { tracks: ShelfTrack[] }) {
  const firstProgress = tracks.findIndex((t) => t.seal.kind === "progress");
  const [active, setActive] = useState(firstProgress >= 0 ? firstProgress : 0);
  const [calm, setCalm] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; moved: boolean; pointerId: number } | null>(null);
  const suppressClick = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setCalm(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const clamp = (i: number) => Math.max(0, Math.min(tracks.length - 1, i));
  const go = (i: number) => setActive(clamp(i));

  const focusBook = (i: number) => {
    stageRef.current
      ?.querySelector<HTMLElement>(`[data-testid="shelf-book-${tracks[clamp(i)].slug}"]`)
      ?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = clamp(active + (e.key === "ArrowRight" ? 1 : -1));
    if (next === active) return;
    e.preventDefault();
    setActive(next);
    requestAnimationFrame(() => focusBook(next));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { startX: e.clientX, moved: false, pointerId: e.pointerId };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      setDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch { /* capture is best-effort */ }
    }
    if (d.moved) setDragX(dx);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.moved) {
      suppressClick.current = true;
      if (dragX <= -56) go(active + 1);
      else if (dragX >= 56) go(active - 1);
    }
    setDragging(false);
    setDragX(0);
  };

  const onClickCapture = (e: ReactSyntheticEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (calm) {
    return (
      <nav aria-label="Course tracks" className="library-scene" data-testid="track-bookshelf">
        <div className="library-grid" role="list">
          {tracks.map((track) => (
            <div key={track.slug} className="tome-cell" role="listitem">
              <Tome track={track} />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  const current = tracks[active];

  return (
    <nav aria-label="Course tracks" className="library-scene library-scene-slider" data-testid="track-bookshelf">
      <div
        ref={stageRef}
        className={cn("library-stage", dragging && "library-stage-dragging")}
        role="group"
        aria-label="Course books slider"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {tracks.map((track, i) => {
          const offset = i - active;
          const abs = Math.abs(offset);
          const hidden = abs > 2;
          const isHovered = hovered === track.slug;
          const boost = isHovered || undefined;
          const shift = offset * 54 + (dragging ? (dragX / 248) * 54 : 0);
          const transform = [
            "translate(-50%, 0)",
            `translateX(${shift}%)`,
            `rotateY(${offset * -32 + (dragging ? Math.max(-8, Math.min(8, dragX * -0.03)) : 0)}deg)`,
            "rotateX(2deg)",
            `translateZ(${-abs * 150 + (boost && abs === 0 ? 64 : 0)}px)`,
          ].join(" ");
          return (
            <Tome
              key={track.slug}
              track={track}
              active={i === active}
              hidden={hidden}
              onFocusBook={() => go(i)}
              onHoverBook={setHovered}
              style={{
                transform,
                zIndex: 20 - abs,
                opacity: hidden ? 0 : abs === 2 ? 0.55 : abs === 1 ? 0.9 : 1,
                visibility: hidden ? "hidden" : "visible",
                pointerEvents: hidden ? "none" : "auto",
                transition: dragging ? "none" : undefined,
              }}
            />
          );
        })}
        <span aria-hidden="true" className="library-rail" />
      </div>

      <p className="library-announcer" role="status">
        {current ? `${current.title} — ${statusText(current)}` : ""}
      </p>

      <div className="library-controls">
        <button
          type="button"
          className="library-arrow"
          aria-label="Previous book"
          disabled={active === 0}
          onClick={() => go(active - 1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div className="library-dots">
          {tracks.map((track, i) => (
            <button
              key={track.slug}
              type="button"
              className={cn("library-dot", i === active && "library-dot-on")}
              aria-label={`Show ${track.title}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="library-arrow"
          aria-label="Next book"
          disabled={active === tracks.length - 1}
          onClick={() => go(active + 1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="library-hint">Drag, tap the arrows, or use ← → keys — tap a book to open it</p>
    </nav>
  );
}

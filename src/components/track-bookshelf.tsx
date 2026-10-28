"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
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

/* Spring settle: slightly underdamped so a book lands with weight. */
const SPRING_K = 165;
const SPRING_C = 21;

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

/** Volume numerals in shelf order: the primer plus five tracks. */
const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

function Tome({ track, numeral, slideLabel, ctaFocusable, style, active, hidden, dim, onSelectBook, onFocusBook, onHoverBook }: {
  track: ShelfTrack;
  /** Sequential volume number printed before the title, e.g. "II". */
  numeral?: string;
  /** "2 of 6" slide position for assistive tech; set on slider slides only. */
  slideLabel?: string;
  /** Roving tabindex: only the centred slide's CTA is in the tab order. */
  ctaFocusable?: boolean;
  style?: CSSProperties;
  active?: boolean;
  hidden?: boolean;
  /** Spotlight dimming for the wings: 1 on the centred book, darker outward. */
  dim?: number;
  onSelectBook?: () => void;
  onFocusBook?: () => void;
  onHoverBook?: (slug: string | null) => void;
}) {
  const ready = track.status === "ready";
  const seal = track.seal;
  const onSelect = (e: ReactMouseEvent<HTMLDivElement>) => {
    // The cover itself never navigates: a tap centres the book. Only the
    // CTA pill below opens the track.
    if ((e.target as HTMLElement).closest("a")) return;
    onSelectBook?.();
  };
  return (
    <div
      aria-hidden={hidden || undefined}
      role={slideLabel ? "group" : undefined}
      aria-roledescription={slideLabel ? "slide" : undefined}
      aria-label={slideLabel}
      className={cn("tome", !ready && "tome-coming")}
      data-testid={`shelf-book-${track.slug}`}
      data-active={active ? "true" : undefined}
      style={{
        ["--leather" as string]: LEATHERS[track.slug] ?? "#4a3521",
        filter: `brightness(${dim ?? 1})${ready ? "" : " saturate(0.45)"}`,
        ...style,
      }}
      onClick={onSelect}
      onMouseEnter={() => onHoverBook?.(track.slug)}
      onMouseLeave={() => onHoverBook?.(null)}
    >
      <span aria-hidden="true" className="tome-spine" />
      <span aria-hidden="true" className="tome-pages" />
      <span className="tome-head">
        <span className="tome-coin">
          <TrackSymbol symbol={track.symbol} className="h-7 w-7 shrink-0" />
        </span>
        <span className="tome-eyebrow">{track.eyebrow}</span>
      </span>
      <span className="tome-title">
        {numeral ? (
          <span aria-hidden="true" className="tome-numeral">{numeral} · </span>
        ) : null}
        {track.title}
      </span>
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
        <Link
          href={`/track/${track.slug}`}
          aria-label={`${track.title} — ${statusText(track)}`}
          tabIndex={hidden || !ctaFocusable ? -1 : undefined}
          className="tome-cta"
          data-testid={`shelf-open-${track.slug}`}
          onFocus={onFocusBook}
        >
          {ready ? (
            <>First drive <span aria-hidden="true">→</span></>
          ) : (
            <>Take a peek <span aria-hidden="true">→</span></>
          )}
        </Link>
      </span>
    </div>
  );
}

type Sample = { x: number; t: number };

/**
 * Course library: leather volumes in a 3D slider inside one single-light
 * scene. Books move with physics — finger-following drag with rubber-band
 * ends, momentum flicks, and a spring settle. One finger, two fingers
 * (which overrides pinch/scroll), mouse, arrows, dots and keys all browse;
 * a tap on a cover centres it — only the CTA pill opens a track.
 * Reduced motion gets the static shelf.
 */
export function TrackBookshelf({ tracks }: { tracks: ShelfTrack[] }) {
  const firstProgress = tracks.findIndex((t) => t.seal.kind === "progress");
  const initial = firstProgress >= 0 ? firstProgress : 0;
  const [active, setActive] = useState(initial);
  const [frame, setFrame] = useState({ p: initial, v: 0 });
  const [calm, setCalm] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(initial);
  const velRef = useRef(0); // books per second, for lean-into-motion tilt
  const springRef = useRef<{ target: number; vel: number; raf: number; afterSettle?: () => void } | null>(null);
  const pointers = useRef(new Map<number, number>());
  const drag = useRef<{
    startX: number;
    startPos: number;
    startActive: number;
    spacing: number;
    samples: Sample[];
    moved: boolean;
    twoFinger: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const max = tracks.length - 1;
  const clampIdx = (i: number) => Math.max(0, Math.min(max, i));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setCalm(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* Two-finger gestures belong to the shelf, not the OS: block pinch-zoom,
     scroll and pull-refresh at the source (non-passive, plus Safari's
     gesturestart) whenever two fingers are on the stage. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const block = (e: Event) => {
      const t = e as TouchEvent;
      if (t.touches && t.touches.length >= 2) e.preventDefault();
    };
    const blockGesture = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", block, { passive: false });
    el.addEventListener("touchmove", block, { passive: false });
    el.addEventListener("gesturestart", blockGesture as EventListener, { passive: false } as AddEventListenerOptions);
    return () => {
      el.removeEventListener("touchstart", block);
      el.removeEventListener("touchmove", block);
      el.removeEventListener("gesturestart", blockGesture as EventListener);
    };
  }, [calm]);

  const applyPos = (p: number, vel = 0) => {
    posRef.current = p;
    velRef.current = vel;
    setFrame({ p, v: vel });
  };

  const stopSpring = () => {
    if (springRef.current) cancelAnimationFrame(springRef.current.raf);
    springRef.current = null;
  };

  /** Spring the shelf from the current position to `target` books. */
  const springTo = (target: number, initialVel = 0, afterSettle?: () => void) => {
    stopSpring();
    const t = clampIdx(target);
    setActive(t);
    springRef.current = { target: t, vel: initialVel, raf: 0, afterSettle };
    let vel = initialVel;
    let last: number | null = null;
    const step = (now: number) => {
      if (last === null) {
        last = now;
        const ref = springRef.current;
        if (ref) ref.raf = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const p = posRef.current;
      const accel = SPRING_K * (t - p) - SPRING_C * vel;
      vel += accel * dt;
      const next = p + vel * dt;
      if (Math.abs(t - next) < 0.001 && Math.abs(vel) < 0.02) {
        const ref = springRef.current;
        springRef.current = null;
        applyPos(t, 0);
        ref?.afterSettle?.();
        return;
      }
      applyPos(next, vel);
      const ref = springRef.current;
      if (ref) ref.raf = requestAnimationFrame(step);
    };
    const ref = springRef.current;
    if (ref) ref.raf = requestAnimationFrame(step);
  };

  useEffect(() => stopSpring, []);

  const go = (i: number) => springTo(i, velRef.current * 0.25);

  const focusBook = (i: number) => {
    stageRef.current
      ?.querySelector<HTMLElement>(`[data-testid="shelf-open-${tracks[clampIdx(i)].slug}"]`)
      ?.focus({ preventScroll: true });
  };

  // WAI-ARIA carousel keyboard contract: arrows move between slides from
  // anywhere inside the widget, Home/End jump to the ends, and focus
  // follows the centred slide's action.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    let next = active;
    if (e.key === "ArrowRight") next = clampIdx(active + 1);
    else if (e.key === "ArrowLeft") next = clampIdx(active - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = max;
    else return;
    if (next === active && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      // At an end: let the key do nothing rather than scroll the page.
      e.preventDefault();
      return;
    }
    e.preventDefault();
    // Focus follows on settle: mid-flight the target can still be hidden,
    // which would make the browser drop the focus.
    springTo(next, 0, () => focusBook(next));
  };

  const spacingPx = () => {
    const book = stageRef.current?.querySelector<HTMLElement>('[data-testid^="shelf-book-"]');
    return (book?.offsetWidth ?? 248) * 0.3;
  };

  const centroid = () => {
    const xs = [...pointers.current.values()];
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopSpring();
    pointers.current.set(e.pointerId, e.clientX);
    /* No capture yet: capturing on press would retarget a plain tap/click
       onto the stage. Capture only once a real glide starts (see move). */
    if (pointers.current.size === 1) {
      drag.current = {
        startX: e.clientX,
        startPos: posRef.current,
        startActive: active,
        spacing: spacingPx(),
        samples: [{ x: e.clientX, t: e.timeStamp }],
        moved: false,
        twoFinger: false,
      };
    } else if (pointers.current.size === 2 && drag.current) {
      // Second finger lands: re-anchor on the centroid, keep gliding.
      drag.current.twoFinger = true;
      drag.current.startX = centroid();
      drag.current.startPos = posRef.current;
      drag.current.samples = [{ x: centroid(), t: e.timeStamp }];
      setDragging(true);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const x = pointers.current.size >= 2 ? centroid() : e.clientX;
    const now = e.timeStamp;
    d.samples.push({ x, t: now });
    d.samples = d.samples.filter((s) => now - s.t <= 140);
    const dx = x - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      setDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch { /* capture is best-effort */ }
    }
    if (!d.moved) return;
    const raw = d.startPos - dx / d.spacing;
    // Rubber-band past either end.
    const banded = raw < 0 ? raw * 0.35 : raw > max ? max + (raw - max) * 0.35 : raw;
    const prev = d.samples.length > 1 ? d.samples[d.samples.length - 2] : d.samples[0];
    const lastS = d.samples[d.samples.length - 1];
    const vel = lastS.t > prev.t ? -((lastS.x - prev.x) / (lastS.t - prev.t)) / d.spacing * 1000 : 0;
    applyPos(banded, vel);
  };

  const releaseVelocity = (d: NonNullable<typeof drag.current>, now: number): number => {
    const fresh = d.samples.filter((s) => now - s.t <= 120);
    if (fresh.length < 2) return 0;
    const first = fresh[0];
    const lastS = fresh[fresh.length - 1];
    if (now - lastS.t > 60 || lastS.t === first.t) return 0; // held still: no flick
    return -((lastS.x - first.x) / (lastS.t - first.t)) / d.spacing; // books per ms
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size > 0) {
      // One finger lifted from a two-finger glide: re-anchor, keep going.
      if (d) {
        d.startX = centroid();
        d.startPos = posRef.current;
        d.samples = [{ x: centroid(), t: e.timeStamp }];
      }
      return;
    }
    if (cancelled) {
      // The browser took the gesture (e.g. a scroll): the drag is dead.
      // Settle where we are and ignore the eventual release entirely.
      drag.current = null;
      setDragging(false);
      if (d?.moved) springTo(Math.round(posRef.current));
      return;
    }
    drag.current = null;
    setDragging(false);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    const velPerMs = releaseVelocity(d, e.timeStamp);
    const projected = posRef.current + velPerMs * 90;
    const shortDrag = Math.abs((d.samples[d.samples.length - 1]?.x ?? d.startX) - d.startX) < d.spacing * 1.5;
    const range = shortDrag ? 1 : 2; // short drags and flicks move at most one book
    const target = clampIdx(
      Math.max(d.startActive - range, Math.min(d.startActive + range, Math.round(projected))),
    );
    springTo(target, velPerMs * 1000);
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
          {tracks.map((track, i) => (
            <div key={track.slug} className="tome-cell" role="listitem">
              <Tome track={track} numeral={NUMERALS[i] ?? String(i + 1)} ctaFocusable />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  const current = tracks[active];
  const tilt = Math.max(-7, Math.min(7, frame.v * 1.1));

  return (
    <nav
      aria-label="Course tracks"
      className="library-scene library-scene-slider"
      data-testid="track-bookshelf"
      onKeyDown={onKeyDown}
    >
      <div
        ref={stageRef}
        className={cn("library-stage", dragging && "library-stage-dragging")}
        role="group"
        aria-label="Course books slider"
        aria-roledescription="carousel"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onClickCapture={onClickCapture}
      >
        {tracks.map((track, i) => {
          const offset = i - frame.p;
          const abs = Math.abs(offset);
          const hidden = abs > 2.6;
          const boost = hovered === track.slug && abs < 0.5;
          // Convergent fan: the wings tuck in close, angle steeply, drop
          // back and down so they slide underneath the centred book.
          // Floats are quantized: the browser normalizes long-precision
          // style attributes on parse, which React would flag as a
          // hydration mismatch.
          const q = (n: number) => Math.round(n * 100) / 100;
          const transform = [
            "translate(-50%, 0)",
            `translateX(${q(offset * 30)}%)`,
            `translateY(${q(Math.pow(abs, 1.6) * 14)}px)`,
            `rotateY(${q(offset * -34 + tilt)}deg)`,
            "rotateX(2deg)",
            `translateZ(${q(-abs * 170 + (boost ? 64 : 0))}px)`,
          ].join(" ");
          // Centre-spotlight: the focused book takes the beam, the wings
          // fall off into the room's dark.
          const dim = abs < 0.5 ? 1.07 : abs < 1.5 ? 0.82 : 0.66;
          return (
            <Tome
              key={track.slug}
              track={track}
              numeral={NUMERALS[i] ?? String(i + 1)}
              slideLabel={`${i + 1} of ${tracks.length}`}
              ctaFocusable={i === active}
              active={i === active}
              hidden={hidden}
              dim={dim}
              onSelectBook={() => go(i)}
              onFocusBook={() => go(i)}
              onHoverBook={setHovered}
              style={{
                transform,
                zIndex: 20 - Math.round(abs),
                opacity: hidden ? 0 : abs > 2 ? Math.max(0, 0.6 - (abs - 2) * 0.8) : abs > 1 ? 0.92 : 1,
                visibility: hidden ? "hidden" : "visible",
                pointerEvents: hidden ? "none" : "auto",
              }}
            />
          );
        })}
        <span aria-hidden="true" className="library-end" />
        <span aria-hidden="true" className="library-end library-end-right" />
        <span aria-hidden="true" className="library-spot" />
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
      <p className="library-hint">Drag or flick — one finger or two — or use ← → keys. Tap a cover to centre it, tap its button to open</p>
    </nav>
  );
}

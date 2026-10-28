"use client";

import Link from "next/link";
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

/** Course library: six standing volumes on a wooden shelf, one shared light. */
export function TrackBookshelf({ tracks }: { tracks: ShelfTrack[] }) {
  return (
    <nav aria-label="Course tracks" className="library-scene" data-testid="track-bookshelf">
      <div className="library-grid" role="list">
        {tracks.map((track) => {
          const ready = track.status === "ready";
          const seal = track.seal;
          const statusText =
            seal.kind === "done"
              ? "done"
              : seal.kind === "progress"
                ? `in progress, ${seal.done} of ${seal.total}`
                : seal.kind === "new"
                  ? "not opened"
                  : "coming next";
          return (
            <div key={track.slug} className="tome-cell" role="listitem">
              <Link
                href={`/track/${track.slug}`}
                aria-label={`${track.title} — ${statusText}`}
                className={cn("tome", !ready && "tome-coming")}
                data-testid={`shelf-book-${track.slug}`}
                style={{ ["--leather" as string]: LEATHERS[track.slug] ?? "#4a3521" }}
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
            </div>
          );
        })}
      </div>
    </nav>
  );
}

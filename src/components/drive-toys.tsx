"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import type { PracticeSet } from "@/lib/practice-types";
import { cn } from "@/lib/utils";

type Beat = "tease" | "hit" | "miss" | "win";

function Stage({
  children,
  beat = "tease",
  className,
}: {
  children: ReactNode;
  beat?: Beat;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "toy-stage",
        beat === "hit" && "toy-hit",
        beat === "miss" && "toy-miss",
        beat === "win" && "toy-win",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SatoshiToy({ win }: { win?: boolean }) {
  return (
    <Stage beat={win ? "win" : "tease"} className={cn("toy-satoshi", win && "is-thrown")}>
      <div className="sat2-stage" aria-hidden>
        <div className="sat2-author">
          <Image
            className="sat2-portrait"
            src="/images/satoshi.jpeg"
            alt="Satoshi Nakamoto wearing a Bitcoin mask"
            width={743}
            height={413}
          />
          <div className="sat2-desk">
            <span className="sat2-desk-paper" />
            <span className={cn("sat2-pen", !win && "is-writing")} />
          </div>
          <span className="sat2-name">SATOSHI</span>
        </div>
        <div className={cn("sat2-paper", win && "is-flying")}>
          <span className="sat2-paper-head">BITCOIN</span>
          <span className="sat2-paper-sub">peer-to-peer e-cash</span>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn("sat2-paper-line", i === 3 && "is-short")}
              style={{ "--d": i } as CSSProperties}
            />
          ))}
          <span className="sat2-paper-stamp">2008</span>
        </div>
        <span className={cn("sat2-trail", win && "is-on")} />
        <div className={cn("sat2-net", win && "is-lit")}>
          <svg className="sat2-mesh" viewBox="0 0 100 130" preserveAspectRatio="none">
            <path d="M16 18 L50 12 L84 18 L78 62 L50 52 L22 62 Z" />
            <path d="M22 62 L50 52 L50 96 L22 108 M78 62 L50 52 L50 96 L78 108" />
            <path d="M16 18 L22 62 M84 18 L78 62 M22 108 L50 96 L78 108" />
          </svg>
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className="sat2-node"
              style={{ "--i": i, "--col": i % 3, "--row": Math.floor(i / 3) } as CSSProperties}
            />
          ))}
          <span className={cn("sat2-live", win && "is-on")}>2009 LIVE</span>
        </div>
      </div>
      <p className="toy-caption">Mask writes · paper → open network</p>
      <p className="sat2-refs">
        <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer">
          White paper (PDF)
        </a>
        <span aria-hidden>·</span>
        <a href="https://bitcoin.org/en/" target="_blank" rel="noopener noreferrer">
          Open network
        </a>
      </p>
    </Stage>
  );
}

export function ScarceToy({ win }: { win?: boolean }) {
  return (
    <Stage beat={win ? "win" : "tease"} className={cn("toy-scarce", win && "is-capped")}>
      <div className="cap3-scene" aria-hidden>
        <div className="cap3-barrel">
          <div className="cap3-mouth" />
          <div className="cap3-coins">
            {[7, 6, 5].map((n, r) =>
              Array.from({ length: n }, (_, c) => (
                <span
                  key={`${r}-${c}`}
                  className="cap3-coin"
                  style={
                    {
                      "--i": r * 7 + c,
                      "--col": c + (6 - n) / 2,
                      "--row": r,
                    } as CSSProperties
                  }
                >
                  ₿
                </span>
              )),
            )}
          </div>
          <div className="cap3-rim" />
          <div className="cap3-staves" />
          <div className="cap3-hoop is-top" />
          <div className="cap3-hoop is-mid" />
          <div className="cap3-hoop is-bot" />
          <div className="cap3-plaque">
            <span className="cap3-plaque-num">21,000,000</span>
            <span className="cap3-plaque-sub">HARD CAP · NO MORE</span>
          </div>
          <span className={cn("cap3-reject", win && "is-bounced")}>+1</span>
        </div>
        <span className={cn("cap3-lock", win && "is-on")}>SEALED</span>
      </div>
      <p className="toy-caption">Walls hold · no coin past 21M</p>
    </Stage>
  );
}

export function BlockToy({ win }: { win?: boolean }) {
  const blocks = [0, 1, 2, 3];
  return (
    <Stage beat={win ? "win" : "tease"} className={cn("toy-block", win && "is-mined")}>
      <div className="mp3-scene" aria-hidden>
        <span className="mp3-timer">~10:00</span>
        <div className={cn("mp3-miner", win && "is-striking")}>
          <span className="mp3-helmet" />
          <span className="mp3-head" />
          <span className="mp3-torso" />
          <span className="mp3-arm">
            <span className="mp3-hammer">
              <span className="mp3-hammer-head" />
              <span className="mp3-hammer-handle" />
            </span>
          </span>
          <span className={cn("mp3-sparks", win && "is-burst")}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="mp3-spark" style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
        </div>
        <div className="mp3-chain">
          {blocks.map((i) => (
            <div key={i} className="mp3-link" style={{ "--i": i } as CSSProperties}>
              <div
                className={cn(
                  "mp3-block",
                  i === blocks.length - 1 && "is-tip",
                  win && i === blocks.length - 1 && "is-sealed",
                )}
              >
                <span className="mp3-face is-top">
                  {win && i === blocks.length - 1 ? (
                    <span className="mp3-seal">TIP</span>
                  ) : null}
                </span>
                <span className="mp3-face is-front">
                  <span className="mp3-strata is-hi" />
                  <span className="mp3-strata is-mid" />
                  <span className="mp3-strata is-lo" />
                </span>
                <span className="mp3-face is-side" />
              </div>
              {i < blocks.length - 1 ? <span className="mp3-connector" /> : null}
            </div>
          ))}
        </div>
      </div>
      <p className="toy-caption">~10 min · miner seals the chain tip</p>
    </Stage>
  );
}

export function HalvingToy({ win }: { win?: boolean }) {
  const eras = [50, 25, 12.5, 6.25];
  const heights = ["6rem", "4.2rem", "3rem", "2.3rem"];
  return (
    <Stage beat={win ? "win" : "tease"} className={cn("toy-halving", win && "is-halved")}>
      <div className="half3-row" aria-hidden>
        {eras.map((n, i) => (
          <div key={n} className="half3-col">
            {i > 0 ? (
              <span className="half3-cut" style={{ "--i": i } as CSSProperties}>
                ÷2
              </span>
            ) : null}
            <div
              className={cn("half3-bar", win && i === eras.length - 1 && "is-current")}
              style={{ "--i": i, "--h": heights[i] } as CSSProperties}
            >
              <span className="half3-face is-top" />
              <span className="half3-face is-front">{n}</span>
              <span className="half3-face is-side" />
              {win && i === eras.length - 1 ? <span className="half3-now">NOW</span> : null}
            </div>
            <span className="half3-era">Era {i + 1}</span>
          </div>
        ))}
      </div>
      <p className="toy-caption">Reward halves each era</p>
    </Stage>
  );
}

export function SatsToy({ win }: { win?: boolean }) {
  const grid = 10;
  const dots = Array.from({ length: grid * grid }, (_, i) => {
    const x = (i % grid) - (grid - 1) / 2;
    const y = Math.floor(i / grid) - (grid - 1) / 2;
    return Math.hypot(x, y);
  });
  return (
    <Stage beat={win ? "win" : "tease"} className={cn("toy-sats", win && "is-filled")}>
      <div className="sats2-coin" aria-hidden>
        <span className="sats2-sheen" />
        <span className="sats2-glyph">₿</span>
        <div className="sats2-dots">
          {dots.map((dist, i) => (
            <span
              key={i}
              className={cn("sats2-dot", dist > 4.7 && "is-off")}
              style={{ "--d": dist.toFixed(2) } as CSSProperties}
            />
          ))}
        </div>
        <span className="sats2-ring" />
      </div>
      <p className={cn("sats2-meter", win && "is-on")}>
        <span>1 BTC</span>
        <span aria-hidden>=</span>
        <span>100,000,000 sats</span>
      </p>
      <p className="sats2-analogy">like 1 USD = 100 cents</p>
      <p className="toy-caption">One coin · a hundred million pieces</p>
    </Stage>
  );
}

export function ChequesToy({
  cheques,
  total,
  typed,
  miss,
  win,
}: {
  cheques: number[];
  total: string;
  typed: string;
  miss?: boolean;
  win?: boolean;
}) {
  const progress = typed.trim().length > 0 ? Math.min(1, typed.trim().length / Math.max(total.length, 1)) : 0;
  const beat: Beat = win ? "win" : miss ? "miss" : progress > 0 ? "hit" : "tease";
  return (
    <Stage beat={beat} className={cn("toy-cheques", win && "is-stacked")}>
      <div
        className="uto2-stack"
        style={{ "--snap": win ? 1 : progress } as CSSProperties}
        aria-hidden
      >
        {cheques.map((amount, i) => (
          <div
            key={i}
            className="uto2-card"
            style={{ "--i": i } as CSSProperties}
          >
            <span className="uto2-perf" />
            <span className="uto2-top">
              <span className="uto2-label">CHEQUE {i + 1} · UTXO</span>
              <span className="uto2-unspent">UNSPENT</span>
            </span>
            <span className="uto2-amt">{amount.toFixed(4)} BTC</span>
            <span className="uto2-sig" />
          </div>
        ))}
        <span className="uto2-shadow" />
        <span className={cn("uto2-stamp", win && "is-on")}>STACKED</span>
      </div>
      <p className={cn("toy-emboss", win && "is-on")}>{win ? `${total} BTC` : "YOUR BALANCE"}</p>
      <p className="toy-caption">Unspent cheques stack into one balance</p>
    </Stage>
  );
}

export function ChangeToy({
  practice,
  spent,
  win,
}: {
  practice: PracticeSet;
  spent: boolean;
  win?: boolean;
}) {
  const toll = (practice.changeFrom - practice.changePay - practice.changeBack).toFixed(4);
  return (
    <Stage beat={win ? "win" : spent ? "hit" : "tease"} className="toy-change">
      <div className={cn("toy-fat-cheque", spent && "is-split")}>
        <span className="toy-cheque-amt">{practice.changeFrom.toFixed(4)}</span>
        <span className={cn("toy-toll-chip", spent && "is-peeled")}>
          {spent ? `TOLL ${toll}` : "TOLL"}
        </span>
      </div>
      <div className={cn("toy-split-out", spent && "is-shown")}>
        <div className="toy-thin-cheque is-pay">
          <span>PAY</span>
          <span>{practice.changePay.toFixed(4)}</span>
        </div>
        <div className="toy-thin-cheque is-back">
          <span>CHANGE</span>
          <span>{practice.changeBack.toFixed(4)}</span>
        </div>
      </div>
      <p className="toy-caption">One cheque in · two out</p>
    </Stage>
  );
}

export function AddressToy({
  address,
  first4,
  last4,
  copied,
  miss,
  win,
}: {
  address: string;
  first4: string;
  last4: string;
  copied: boolean;
  miss?: boolean;
  win?: boolean;
}) {
  const head = address.slice(0, 4);
  const tail = address.slice(-4);
  const headOk = first4.trim().toLowerCase() === head;
  const tailOk = last4.trim().toLowerCase() === tail;
  const beat: Beat = win ? "win" : miss ? "miss" : headOk || tailOk || copied ? "hit" : "tease";
  return (
    <Stage beat={beat} className={cn("toy-address", win && "is-locked")}>
      <div className="toy-plate">
        <span className="toy-runway-wrap">
          <span className="toy-runway-tag">FIRST 4</span>
          <span className={cn("toy-runway is-head", (headOk || win) && "is-lit")}>{head}</span>
        </span>
        <span className="toy-plate-mid">····</span>
        <span className="toy-runway-wrap">
          <span className="toy-runway-tag">LAST 4</span>
          <span className={cn("toy-runway is-tail", (tailOk || win) && "is-lit")}>{tail}</span>
        </span>
      </div>
      <p className="toy-caption">{win ? "Ends locked" : copied ? "Check the runway lights" : "Match first 4 + last 4"}</p>
    </Stage>
  );
}

export function ReceiptToy({
  found,
  confirms,
  amount,
  win,
}: {
  found: boolean;
  confirms: number;
  amount: string;
  win?: boolean;
}) {
  const beat: Beat = win ? "win" : found && confirms > 0 ? "hit" : found ? "tease" : "tease";
  return (
    <Stage beat={beat} className="toy-receipt">
      <div className="toy-printer">
        <div className="toy-printer-slot" aria-hidden />
        <div className={cn("toy-slip", found && "is-out", win && "is-safe")}>
          <span className="toy-slip-tag">RECEIPT</span>
          <span className="toy-slip-amt">{found ? amount : "—"}</span>
          <div className="toy-stamps">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={cn("toy-confirm-stamp", confirms >= n && "is-slammed")}
                style={{ "--i": n - 1 } as CSSProperties}
              >
                {n}
              </span>
            ))}
          </div>
          <span className="toy-slip-count">
            {confirms >= 3 ? "3 / 3 — LANDED" : found ? `${confirms} / 3 CONFIRMED` : "0 / 3 — PASTE TO LOOK UP"}
          </span>
          {win || confirms >= 3 ? <span className="toy-safe-tag">SAFE</span> : null}
        </div>
      </div>
      <p className="toy-caption">{confirms >= 3 ? "Landed" : found ? `${confirms} confirmations` : "Paste the receipt"}</p>
    </Stage>
  );
}

export function SwapToy({ pasted, intendedEnd, pastedEnd, win }: {
  pasted: boolean;
  intendedEnd: string;
  pastedEnd: string;
  win?: boolean;
}) {
  return (
    <Stage beat={win ? "win" : pasted ? "miss" : "tease"} className="toy-swap">
      <div className="toy-split-plate">
        <div className="toy-end is-true">
          <span>TRUE END</span>
          <span className="font-mono">{intendedEnd}</span>
        </div>
        <span className={cn("toy-vs", pasted && "is-no")}>{pasted ? "≠" : "vs"}</span>
        <div className={cn("toy-end is-bad", pasted && "is-sheared", win && "is-gone")}>
          <span>PASTE END</span>
          <span className="font-mono">{pastedEnd}</span>
        </div>
      </div>
      <p className="toy-caption">
        {win ? "Trap rejected" : pasted ? "Ends differ — reject it" : "Paste to reveal the trap"}
      </p>
    </Stage>
  );
}

export function TollToy({
  pace,
  win,
}: {
  pace: "slow" | "fast" | null;
  win?: boolean;
}) {
  return (
    <Stage
      beat={win ? "win" : pace === "fast" ? "miss" : pace === "slow" ? "hit" : "tease"}
      className="toy-toll"
    >
      <div className="toy-highway">
        <div className={cn("toy-lane is-fast", pace === "fast" && "is-active")}>
          <span>FAST</span>
          <span className="toy-lane-sub">costs more</span>
          <span className="toy-siren" aria-hidden />
        </div>
        <div className={cn("toy-lane is-slow", (pace === "slow" || win) && "is-open")}>
          <span>SLOW</span>
          <span className="toy-lane-sub">cheaper</span>
          <span className="toy-gate" aria-hidden />
          <span className="toy-green" aria-hidden />
        </div>
      </div>
      <p className="toy-caption">
        {pace === "fast"
          ? "Siren — leave room for the toll"
          : pace === "slow"
            ? "Gate open — cheap lane"
            : "Slow is cheap · fast costs more"}
      </p>
    </Stage>
  );
}

export function NoUndoToy({ sent, win }: { sent: boolean; win?: boolean }) {
  return (
    <Stage beat={win ? "win" : sent ? "hit" : "tease"} className="toy-noundo">
      <div className="toy-dive">
        <div className="toy-board" aria-hidden />
        <div className={cn("toy-dive-coin", sent && "is-gone")} aria-hidden>
          ₿
        </div>
        <div className="toy-water" aria-hidden />
      </div>
      <div className={cn("toy-undo-btn", sent && "is-cracked")}>UNDO</div>
      <p className="toy-caption">{sent ? "No rewind" : "Coin on the board"}</p>
    </Stage>
  );
}

export function KeyContrastToy({
  sharedAddress,
  sharedKey,
  win,
}: {
  sharedAddress: boolean;
  sharedKey: boolean;
  win?: boolean;
}) {
  return (
    <Stage beat={win ? "win" : sharedAddress || sharedKey ? "hit" : "tease"} className="toy-keys">
      <div className="toy-diorama">
        <div className={cn("toy-mailbox", sharedAddress && "is-full")}>
          <span>ADDRESS</span>
          <span className="toy-mail" aria-hidden />
        </div>
        <div className={cn("toy-vault-key", sharedKey && "is-melt")}>
          <span>KEY</span>
          <span className="toy-key-shape" aria-hidden />
        </div>
      </div>
      <p className="toy-caption">Mailbox fills · key melts if shown</p>
    </Stage>
  );
}

export function SeedToy({
  words,
  picked,
  phase,
  miss,
  win,
}: {
  words: string[];
  picked: number[];
  phase: string;
  miss?: boolean;
  win?: boolean;
}) {
  return (
    <Stage beat={win ? "win" : miss ? "miss" : picked.length > 0 ? "hit" : "tease"} className="toy-seed">
      <div className={cn("toy-paper-vault", phase !== "write" && "is-turned")}>
        <ol className="toy-word-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <li key={i} className={cn("toy-word-slot", picked[i] !== undefined && "is-stamped")}>
              <span className="toy-word-n">{i + 1}</span>
              {picked[i] !== undefined ? words[picked[i]] : "—"}
            </li>
          ))}
        </ol>
      </div>
      <p className="toy-caption">
        {win ? "Vault sealed" : phase === "chat" ? "Refuse the chat" : "Words stamp in order"}
      </p>
    </Stage>
  );
}

export function SupportToy({ closed, miss }: { closed?: boolean; miss?: boolean }) {
  return (
    <Stage beat={closed ? "win" : miss ? "miss" : "tease"} className="toy-support">
      <div className={cn("toy-phish-bubble", closed && "is-shredding")}>
        Support: paste your 12 words…
      </div>
      <div className={cn("toy-shredder", closed && "is-on")} aria-hidden />
      <p className="toy-caption">{closed ? "Shredded" : "Close the fake chat"}</p>
    </Stage>
  );
}

export function NetworkToy({ bitcoin, win }: { bitcoin: boolean; win?: boolean }) {
  return (
    <Stage beat={win ? "win" : bitcoin ? "hit" : "tease"} className="toy-network">
      <div className="toy-doors">
        <div className={cn("toy-door is-eth", !bitcoin && "is-rattle", bitcoin && "is-sealed")}>
          ETH
        </div>
        <div className={cn("toy-door is-btc", bitcoin && "is-open")}>BTC</div>
      </div>
      <p className="toy-caption">{bitcoin ? "Bitcoin door unlocked" : "Wrong network rattles"}</p>
    </Stage>
  );
}

export function MismatchToy({
  destEnd,
  swappedEnd,
  stopped,
  miss,
}: {
  destEnd: string;
  swappedEnd: string;
  stopped?: boolean;
  miss?: boolean;
}) {
  return (
    <Stage beat={stopped ? "win" : miss ? "miss" : "tease"} className="toy-mismatch">
      <div className={cn("toy-trapdoor", stopped && "is-slammed")}>
        <span className="toy-send-arm">SEND</span>
        <span className="font-mono text-[var(--danger)]">{swappedEnd}</span>
        <span className="toy-meant font-mono text-[var(--mute)]">meant {destEnd}</span>
      </div>
      <p className="toy-caption">{stopped ? "Trap slammed shut" : "Stop before it drops"}</p>
    </Stage>
  );
}

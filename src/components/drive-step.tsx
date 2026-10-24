"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CertifyForm } from "@/components/certify-form";
import { CopyChip } from "@/components/copy-chip";
import { DriveRail, RouteDrawer, type RailStep } from "@/components/drive-rail";
import { WalletModal } from "@/components/wallet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publish } from "@/components/journey/journey-bus";
import { driveKey, JOURNEY_DRIVES } from "@/components/journey/registry";
import { JOURNEY_3D_ENABLED } from "@/components/journey/enabled";
import { useWebGLAvailable } from "@/components/journey/use-webgl";
import type { IntroScene, QuickCheck, Step } from "@/lib/content";
import type { BitcoinNetwork } from "@/lib/bitcoin/provider";
import { PIZZA_EXPLORER } from "@/lib/explorer-lesson";
import {
  examReadiness,
  explorerTxUrl,
  isOnChainTx,
  truncateMiddle,
  type WalletState,
} from "@/lib/wallet";
import {
  CUSTODY_MODELS,
  FEE_STRATEGY,
  POLICY_THRESHOLDS,
  gradeExplainText,
  type PracticeSet,
  type StepAnswer,
} from "@/lib/practice-types";
import { cn } from "@/lib/utils";

type Props = {
  step: Step;
  practice: PracticeSet;
  nextHref: string;
  prevHref: string;
  alreadyPassed: boolean;
  canCertify: boolean;
  existingCertId: string | null;
  trackTitle: string;
  trackSlug: string;
  driveSlug: string;
  driveTitle: string;
  driveOutcome?: string;
  driveIndex: number;
  driveCount: number;
  stepIndex: number;
  stepCount: number;
  network: BitcoinNetwork;
  esploraBase: string;
  route: RailStep[];
  /** Exam attempt marker (ISO). Only the exam step receives one. */
  examSince?: string | null;
};

const FootPrimaryContext = createContext<(node: ReactNode) => void>(() => undefined);
const BareContext = createContext(false);
const RailContext = createContext<{
  route: RailStep[];
  driveLabel: string;
  stepLabel: string;
  explorerUrl: string;
  onOpenWallet: (trigger: HTMLElement) => void;
  walletSync: number;
}>({
  route: [],
  driveLabel: "",
  stepLabel: "",
  explorerUrl: "https://mempool.space",
  onOpenWallet: () => undefined,
  walletSync: 0,
});

function useFootPrimary(node: ReactNode, deps: unknown[]) {
  const setPrimary = useContext(FootPrimaryContext);
  useEffect(() => {
    setPrimary(node);
    return () => setPrimary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes explicit deps
  }, deps);
}

export function DriveStep({
  step,
  practice,
  nextHref,
  prevHref,
  alreadyPassed,
  canCertify,
  existingCertId,
  trackTitle,
  trackSlug,
  driveSlug,
  driveTitle,
  driveOutcome,
  driveIndex,
  driveCount,
  stepIndex,
  stepCount,
  network,
  esploraBase,
  route,
  examSince,
}: Props) {
  const router = useRouter();
  const [solved, setSolved] = useState(alreadyPassed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [footPrimary, setFootPrimary] = useState<ReactNode>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const routeTriggerRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletSync, setWalletSync] = useState(0);
  const walletTriggerRef = useRef<HTMLElement | null>(null);
  const openWallet = useCallback((trigger: HTMLElement) => {
    walletTriggerRef.current = trigger;
    setDrawerOpen(false);
    setWalletOpen(true);
  }, []);
  const closeWallet = useCallback(() => {
    setWalletOpen(false);
    // Bump so scenes holding wallet state (exam) re-fetch on close.
    setWalletSync((s) => s + 1);
  }, []);
  const railValue = useMemo(
    () => ({
      route,
      driveLabel: `Drive ${driveIndex + 1} · ${driveTitle}`,
      stepLabel: `Step ${stepIndex + 1} of ${stepCount}`,
      explorerUrl:
        step.action.type === "explorer-read" ? step.action.explorerUrl : "https://mempool.space",
      onOpenWallet: openWallet,
      walletSync,
    }),
    [route, driveIndex, driveTitle, stepIndex, stepCount, step.action, openWallet, walletSync],
  );

  const done = solved || alreadyPassed;
  const continueLabel = nextHref === "/course" ? "Back to your course" : "Continue";
  const journeyKey = driveKey(trackSlug, driveSlug);
  // 2D-first: the 3D stage only mounts when the master switch allows it.
  const webgl = useWebGLAvailable();
  const immersive = JOURNEY_3D_ENABLED && webgl && JOURNEY_DRIVES.has(journeyKey);

  useEffect(() => {
    publish("step:win", done);
  }, [done]);

  // Arrow-key drive: left/right move back/continue, up/down move focus.
  // Never hijack keys while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        // Click the live Back link: immune to stale closures mid-transition.
        const back = document.querySelector(".drive-foot > a[href]") as HTMLElement | null;
        back?.click();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const btns = [...document.querySelectorAll(".drive-foot button:not([disabled])")];
        const primary = btns[btns.length - 1] as HTMLElement | undefined;
        primary?.click();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [
          ...document.querySelectorAll(
            "main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled])",
          ),
        ] as HTMLElement[];
        if (items.length === 0) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === "ArrowDown"
            ? items[(i + 1) % items.length]
            : items[(i - 1 + items.length) % items.length];
        next.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function commit(answer?: StepAnswer) {
    if (busy || done) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id, answer }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save this screen.");
        return;
      }
      setSolved(true);
      router.refresh();
      if (!step.pocketCard && !step.cert) {
        router.push(nextHref);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <FootPrimaryContext.Provider value={setFootPrimary}>
      <div className={cn(immersive ? "drive-immersive pb-4" : "space-y-6 pb-4")}>
        <div className="drive-head">
          <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-[var(--amber)]">
            STOP {driveIndex + 1} / {driveCount} · {driveTitle.toUpperCase()}
            <span className="text-[var(--mute)]">
              {" "}
              · SCREEN {stepIndex + 1} / {stepCount}
            </span>
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-4xl">
            {step.title ?? step.job}
          </h1>
          {driveSlug === "get-paid" ||
          driveSlug === "send" ||
          driveSlug === "guard" ||
          driveSlug === "road-test" ? (
            <p className="mt-2 text-sm text-[var(--mute)]">
              Play money — not real Bitcoin.
            </p>
          ) : null}
          {step.objective || driveOutcome ? (
            <p className="drive-outcome">{step.objective ?? driveOutcome}</p>
          ) : null}
          <div
            className="hud-dots"
            role="img"
            aria-label={`Step ${stepIndex + 1} of ${stepCount}`}
          >
            {Array.from({ length: stepCount }, (_, i) => (
              <span
                key={i}
                className={cn("hud-dot", i < stepIndex && "is-done", i === stepIndex && "is-now")}
              />
            ))}
          </div>
          <button
            ref={routeTriggerRef}
            type="button"
            className="drive-route-trigger"
            onClick={() => setDrawerOpen(true)}
          >
            Route
          </button>
        </div>

        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {immersive ? <div className="hud-window" aria-hidden="true" /> : null}
        <RailContext.Provider value={railValue}>
          <BareContext.Provider value={immersive}>
            <Scene
              step={step}
              practice={practice}
              review={done}
              busy={busy}
              onCommit={(answer) => void commit(answer)}
              network={network}
              esploraBase={esploraBase}
              examSince={examSince}
            />
          </BareContext.Provider>
        </RailContext.Provider>
        <RouteDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          triggerRef={routeTriggerRef}
          driveLabel={railValue.driveLabel}
          stepLabel={railValue.stepLabel}
          steps={railValue.route}
          explorerUrl={railValue.explorerUrl}
          onOpenWallet={railValue.onOpenWallet}
        />
        <WalletModal
          open={walletOpen}
          onClose={closeWallet}
          triggerRef={walletTriggerRef}
          network={network}
          esploraBase={esploraBase}
        />

        {done && step.pocketCard ? (
          <div className="success-burst rounded-2xl border border-[var(--go)]/40 bg-[var(--cabin)] px-5 py-4">
            <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.16em] text-[var(--go)]">
              POCKET CARD
            </p>
            <p className="mt-2 text-[var(--paper)]">{step.pocketCard}</p>
          </div>
        ) : null}

        {done && step.cert ? (
          canCertify && existingCertId ? (
            <div className="max-w-xl space-y-4">
              <p className="coach-cue text-lg leading-relaxed text-[var(--fog)]">
                Your {trackTitle} certificate is already issued. One per course.
              </p>
              <Link href={`/cert/${existingCertId}`}>
                <Button size="lg">Open my certificate</Button>
              </Link>
            </div>
          ) : canCertify ? (
            <CertifyForm moduleSlug={step.id} courseTitle={trackTitle} />
          ) : (
            <div className="max-w-xl space-y-4 rounded-2xl border border-[var(--lane)] bg-[var(--cabin)] p-5">
              <p className="text-[var(--fog)]">
                You finished the final drive. The verify link comes with{" "}
                <span className="text-[var(--paper)]">Certified Practitioner</span>.
              </p>
              <p className="text-sm text-[var(--mute)]">
                Demo upgrade: unlock again with{" "}
                <span className="font-mono text-[var(--fog)]">CD-DRIVE-2026</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/unlock">
                  <Button>Upgrade this demo</Button>
                </Link>
                <Link href="/course">
                  <Button variant="secondary">Back to your course</Button>
                </Link>
              </div>
            </div>
          )
        ) : null}

        <div className="drive-foot">
          <Link href={prevHref}>
            <Button variant="secondary" size="lg" className="drive-foot-solid" aria-keyshortcuts="ArrowLeft">
              ← Back
            </Button>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {done && !step.cert ? (
              <Link href={nextHref}>
                <Button size="lg" className="success-burst" aria-keyshortcuts="ArrowRight">
                  {continueLabel}
                </Button>
              </Link>
            ) : null}
            {!done ? footPrimary : null}
          </div>
        </div>
      </div>
    </FootPrimaryContext.Provider>
  );
}

function Split({ coach, children }: { coach: string; children: ReactNode }) {
  const bare = useContext(BareContext);
  const rail = useContext(RailContext);
  if (bare) {
    return (
      <div className="hud-stack">
        <div className="hud-coach">
          <p className="coach-cue text-lg leading-relaxed text-[var(--fog)] sm:text-xl">
            <span className="mb-2 block font-[family-name:var(--font-display)] text-xs tracking-[0.2em] text-[var(--amber)]">
              COACH
            </span>
            {coach}
          </p>
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="drive-layout">
      <DriveRail
        driveLabel={rail.driveLabel}
        stepLabel={rail.stepLabel}
        steps={rail.route}
        explorerUrl={rail.explorerUrl}
        onOpenWallet={rail.onOpenWallet}
      />
      <div className="min-w-0 space-y-5">
        <div className="drive-prose">
          <p className="coach-cue text-lg leading-relaxed text-[var(--fog)] sm:text-xl">
            <span className="mb-2 block font-[family-name:var(--font-display)] text-xs tracking-[0.2em] text-[var(--amber)]">
              COACH
            </span>
            {coach}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Scene({
  step,
  practice,
  review,
  busy,
  onCommit,
  network,
  esploraBase,
  examSince,
}: {
  step: Step;
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
  network: BitcoinNetwork;
  esploraBase: string;
  examSince?: string | null;
}) {
  const action = step.action;
  if (action.type === "intro") {
    return (
      <IntroSceneView
        step={step}
        scene={action.scene}
        practice={practice}
        review={review}
        busy={busy}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "explorer-read") {
    return (
      <ExplorerReadScene
        step={step}
        txid={action.txid}
        explorerUrl={action.explorerUrl}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "address-check") {
    return (
      <AddressScene
        practice={practice}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "receipt") {
    return (
      <ReceiptScene
        practice={practice}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "clipboard-mismatch") {
    return (
      <SwapScene
        practice={practice}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "fee-room") {
    return (
      <FeeScene
        practice={practice}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "send-confirm") {
    return (
      <SendScene
        practice={practice}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "key-contrast") {
    return (
      <KeyScene
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "seed-card") {
    return (
      <SeedScene
        practice={practice}
        review={review}
        busy={busy}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (action.type === "policy-pick") {
    return <PolicyScene step={step} review={review} busy={busy} onCommit={onCommit} />;
  }
  if (action.type === "model-compare") {
    return <CompareScene step={step} review={review} busy={busy} onCommit={onCommit} />;
  }
  if (action.type === "fee-strategy") {
    return <FeeStrategyScene step={step} review={review} busy={busy} onCommit={onCommit} />;
  }
  if (action.type === "seed-restore") {
    return (
      <RestoreScene step={step} practice={practice} review={review} busy={busy} onCommit={onCommit} />
    );
  }
  if (action.type === "free-write-rubric") {
    return <ExplainScene step={step} review={review} busy={busy} onCommit={onCommit} />;
  }
  if (action.type === "wallet-exam") {
    return (
      <ExamScene
        step={step}
        review={review}
        busy={busy}
        onCommit={onCommit}
        network={network}
        esploraBase={esploraBase}
        examSince={examSince}
      />
    );
  }
  return (
    <RoadScene
      scene={action.scene}
      practice={practice}
      review={review}
      busy={busy}
      button={step.button}
      coach={step.coachLine}
      onCommit={onCommit}
    />
  );
}

function Frame({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--lane)] bg-[var(--cabin)] p-5 sm:p-6",
        className,
      )}
    >
      <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.16em] text-[var(--mute)]">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function IdeaPanel({
  step,
  extras,
}: {
  step: Step;
  extras?: ReactNode;
}) {
  if (!step.ideaTitle && !step.ideaBody) return null;
  return (
    <Frame title={step.ideaTitle ?? "THE IDEA"} className="drive-prose">
      {step.ideaBody ? (
        <p className="text-sm leading-relaxed text-[var(--fog)]">{step.ideaBody}</p>
      ) : null}
      {step.whyItMatters ? (
        <p className="mt-3 text-sm text-[var(--mute)]">
          <span className="text-[var(--fog)]">Why it matters: </span>
          {step.whyItMatters}
        </p>
      ) : null}
      {step.keyTerms && step.keyTerms.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {step.keyTerms.map((term) => (
            <li
              key={term}
              className="rounded-full border border-[var(--lane)] px-3 py-1 text-xs tracking-[0.08em] text-[var(--fog)]"
            >
              {term}
            </li>
          ))}
        </ul>
      ) : null}
      {step.misconception ? (
        <p className="mt-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-sm text-[var(--fog)]">
          <span className="font-[family-name:var(--font-display)] text-xs tracking-[0.14em] text-[var(--danger)]">
            NOT THIS{" "}
          </span>
          {step.misconception}
        </p>
      ) : null}
      {extras}
    </Frame>
  );
}

function IntroSceneView({
  step,
  scene,
  practice,
  review,
  busy,
  onCommit,
}: {
  step: Step;
  scene: IntroScene;
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
}) {
  if (scene === "cheques") {
    return (
      <ChequesIntro
        step={step}
        practice={practice}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  if (scene === "change") {
    return (
      <ChangeIntro
        step={step}
        practice={practice}
        review={review}
        busy={busy}
        button={step.button}
        coach={step.coachLine}
        onCommit={onCommit}
      />
    );
  }
  return (
    <IdeaIntro
      step={step}
      scene={scene}
      review={review}
      busy={busy}
      button={step.button}
      coach={step.coachLine}
      onCommit={onCommit}
    />
  );
}

function ChequesIntro({
  step,
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  step: Step;
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [total, setTotal] = useState(review ? practice.chequesTotal : "");
  const [localError, setLocalError] = useState<string | null>(null);
  const progress =
    total.trim().length > 0
      ? Math.min(1, total.trim().length / Math.max(practice.chequesTotal.length, 1))
      : 0;

  useEffect(() => {
    publish("cheques-progress", progress);
  }, [progress]);

  useFootPrimary(
    review ? null : (
      <Button
        size="lg"
        disabled={busy}
        onClick={() => {
          const got = total.trim();
          if (got !== practice.chequesTotal && Number(got) !== Number(practice.chequesTotal)) {
            setLocalError("Add the three cheques. That total is your balance.");
            return;
          }
          setLocalError(null);
          onCommit({ chequesTotal: practice.chequesTotal });
        }}
      >
        {button}
      </Button>
    ),
    [review, busy, button, total, practice.chequesTotal],
  );

  return (
    <Split
      coach={coach}
    >
      <IdeaPanel step={step} />
      <Frame title="YOUR UNSPENT CHEQUES">
        <ul className="space-y-3">
          {practice.cheques.map((amount, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl border border-[var(--lane)] px-4 py-3"
            >
              <span className="text-sm text-[var(--mute)]">Cheque {i + 1}</span>
              <span className="font-mono text-[var(--paper)]">{amount.toFixed(4)} BTC</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--mute)]">
          No bank account. These three cheques are your balance.
        </p>
      </Frame>
      {review ? (
        <p className="text-sm text-[var(--go)]">Balance {practice.chequesTotal} BTC.</p>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-[var(--fog)]" htmlFor="cheques-total">
            Total of the three cheques (BTC)
            <Input
              id="cheques-total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              autoComplete="off"
              inputMode="decimal"
              className="mt-1 font-mono"
            />
          </label>
          {localError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {localError}
            </p>
          ) : null}
        </div>
      )}
    </Split>
  );
}

function ChangeIntro({
  step,
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  step: Step;
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [spent, setSpent] = useState(review);

  useEffect(() => {
    publish("change-spent", spent || review);
  }, [spent, review]);

  useFootPrimary(
    review ? null : spent ? (
      <Button size="lg" disabled={busy} onClick={() => onCommit()}>
        {button}
      </Button>
    ) : (
      <Button size="lg" onClick={() => setSpent(true)}>
        Sign and send
      </Button>
    ),
    [review, spent, busy, button],
  );

  return (
    <Split coach={coach}>
      <IdeaPanel step={step} />
      <Frame title="ONE CHEQUE IN, TWO CHEQUES OUT">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--mute)]">You sign this cheque</dt>
            <dd className="font-mono text-[var(--paper)]">{practice.changeFrom.toFixed(4)} BTC</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--mute)]">They receive</dt>
            <dd className="font-mono text-[var(--paper)]">{practice.changePay.toFixed(4)} BTC</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--mute)]">Toll</dt>
            <dd className="font-mono text-[var(--paper)]">{practice.slowFee.toFixed(4)} BTC</dd>
          </div>
          {spent || review ? (
            <div className="flex justify-between gap-4 border-t border-[var(--lane)] pt-3">
              <dt className="text-[var(--go)]">Change back to you</dt>
              <dd className="font-mono text-[var(--go)]">{practice.changeBack.toFixed(4)} BTC</dd>
            </div>
          ) : (
            <p className="text-[var(--mute)]">Press send to see the leftover return.</p>
          )}
        </dl>
      </Frame>
    </Split>
  );
}

function IdeaIntro({
  step,
  scene,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  step: Step;
  scene: Exclude<IntroScene, "cheques" | "change">;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {

  useFootPrimary(
    review ? null : (
      <Button
        size="lg"
        disabled={busy}
        onClick={() => {
          onCommit();
        }}
      >
        {button}
      </Button>
    ),
    [review, busy, button, scene],
  );

  const satoshiLinks =
    scene === "satoshi" ? (
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          <a
            href="https://bitcoin.org/bitcoin.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--amber)] underline-offset-2 hover:underline"
          >
            Bitcoin white paper (PDF)
          </a>
        </li>
        <li>
          <a
            href="https://bitcoin.org/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--amber)] underline-offset-2 hover:underline"
          >
            Open network — bitcoin.org
          </a>
        </li>
      </ul>
    ) : null;

  return (
    <Split coach={coach}>
      <IdeaPanel step={step} extras={satoshiLinks} />
    </Split>
  );
}

function ExplorerReadScene({
  step,
  txid,
  explorerUrl,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  step: Step;
  txid: string;
  explorerUrl: string;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [confirmed, setConfirmed] = useState<"yes" | "no" | "">(review ? "yes" : "");
  const [confirmations, setConfirmations] = useState(review ? "100000" : "");
  const [feeRate, setFeeRate] = useState(review ? "4191" : "");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    const answer: StepAnswer = {
      explorerConfirmed: confirmed === "yes" || confirmed === "no" ? confirmed : undefined,
      explorerConfirmations: Number(confirmations),
      explorerFeeRate: Number(feeRate),
    };
    // Client-side preview of the same loose rules (server re-grades on /api/progress).
    if (confirmed !== "yes") {
      setLocalError(
        "Open the explorer link. Is this transaction confirmed? Pick yes when status says confirmed.",
      );
      return;
    }
    const confirms = Number(confirmations);
    if (!Number.isFinite(confirms) || confirms < PIZZA_EXPLORER.confirmationsMin) {
      setLocalError(
        `Confirmations grow over time. Enter the number you see (at least ${PIZZA_EXPLORER.confirmationsMin.toLocaleString("en-US")}).`,
      );
      return;
    }
    const fee = Number(feeRate);
    if (
      !Number.isFinite(fee) ||
      fee < PIZZA_EXPLORER.feeRateMin ||
      fee > PIZZA_EXPLORER.feeRateMax
    ) {
      setLocalError("Find the fee rate in sat/vB on the explorer page (near the fee). Enter that number.");
      return;
    }
    setLocalError(null);
    onCommit(answer);
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={submit}>
        {button}
      </Button>
    ),
    [review, busy, button, confirmed, confirmations, feeRate],
  );

  const checklist = [
    "Status (confirmed / in mempool)",
    "Confirmations",
    "Block height",
    "Fee rate (sat/vB)",
    "Inputs",
    "Outputs",
    "Addresses",
  ];

  return (
    <Split
      coach={coach}
    >
      <Frame title="MAINNET TXID">
        <CopyChip value={txid} label="transaction id" className="text-left" />
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex w-fit items-center rounded-xl bg-[var(--amber)] px-4 py-2.5 text-sm font-medium text-[var(--on-btc)] hover:opacity-90"
        >
          Open on mempool.space
        </a>
      </Frame>
      <IdeaPanel step={step} />
      <Frame title="READ ON THE EXPLORER">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--fog)]">
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/5 px-3 py-2 text-sm text-[var(--fog)]">
          Privacy: looking up your own addresses on a public explorer leaks information. Prefer
          your own node for real use. This lesson uses a famous historical payment, not your
          practice wallet.
        </p>
        <p className="mt-3 text-xs text-[var(--mute)]">
          Education only — not financial advice. No live API call; you open the explorer yourself.
          Famous mainnet read — your personal practice elsewhere stays play money.
        </p>
      </Frame>
      <Frame title="THREE CHECKS">
        {review ? (
          <p className="text-sm text-[var(--go)]">Explorer checks recorded.</p>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="text-sm text-[var(--fog)]">Is this transaction confirmed?</legend>
              <div className="mt-2 flex gap-3">
                <label className="flex items-center gap-2 text-sm text-[var(--paper)]">
                  <input
                    type="radio"
                    name="explorer-confirmed"
                    checked={confirmed === "yes"}
                    onChange={() => setConfirmed("yes")}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--paper)]">
                  <input
                    type="radio"
                    name="explorer-confirmed"
                    checked={confirmed === "no"}
                    onChange={() => setConfirmed("no")}
                  />
                  No
                </label>
              </div>
            </fieldset>
            <label className="block text-sm text-[var(--fog)]" htmlFor="explorer-confirms">
              How many confirmations does it have right now?
              <Input
                id="explorer-confirms"
                inputMode="numeric"
                value={confirmations}
                onChange={(e) => setConfirmations(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 font-mono"
              />
            </label>
            <label className="block text-sm text-[var(--fog)]" htmlFor="explorer-fee">
              What is the fee rate in sat/vB?
              <Input
                id="explorer-fee"
                inputMode="decimal"
                value={feeRate}
                onChange={(e) => setFeeRate(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 font-mono"
              />
            </label>
            {localError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {localError}
              </p>
            ) : null}
          </div>
        )}
      </Frame>
      {step.quickCheck ? <QuickCheckView check={step.quickCheck} /> : null}
    </Split>
  );
}

function AddressScene({
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [copied, setCopied] = useState(review);
  const [first4, setFirst4] = useState(review ? practice.address.slice(0, 4) : "");
  const [last4, setLast4] = useState(review ? practice.address.slice(-4) : "");
  const [localError, setLocalError] = useState<string | null>(null);
  const headOk = first4.trim().toLowerCase() === practice.address.slice(0, 4);
  const tailOk = last4.trim().toLowerCase() === practice.address.slice(-4);

  useEffect(() => {
    publish("address-copied", copied);
    publish("address-ends", (headOk ? 1 : 0) + (tailOk ? 1 : 0));
  }, [copied, headOk, tailOk]);

  function check() {
    const ok =
      first4.trim().toLowerCase() === practice.address.slice(0, 4) &&
      last4.trim().toLowerCase() === practice.address.slice(-4);
    if (!copied) {
      setLocalError("Copy the address first, then check the ends.");
      return;
    }
    if (!ok) {
      setLocalError("Match the first 4 and the last 4 on the wallet screen.");
      return;
    }
    setLocalError(null);
    onCommit({ first4: first4.trim(), last4: last4.trim() });
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={check}>
        {button}
      </Button>
    ),
    [review, busy, button, first4, last4, copied],
  );

  return (
    <Split
      coach={coach}
    >
      <Frame title="SHARE THIS">
        <CopyChip
          value={practice.address}
          label="Bitcoin address"
          copied={copied}
          onCopiedChange={setCopied}
        />
        <p className="mt-3 text-sm text-[var(--mute)]">
          {copied ? "On your clipboard — paste it into the wallet check below." : "Tap the address to copy it."}{" "}
          Bitcoin addresses look like bc1…. If it starts with 0x, stop.
        </p>
      </Frame>
      <Frame title="WALLET SCREEN">
        <p className="break-all rounded-xl border border-[var(--lane)] bg-[var(--cabin)] px-3.5 py-3 font-mono text-sm text-[var(--paper)]">
          {practice.address}
        </p>
        {review ? (
          <p className="mt-4 text-sm text-[var(--go)]">Ends checked.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-[var(--fog)]" htmlFor="first4">
              First 4
              <Input
                id="first4"
                value={first4}
                onChange={(e) => setFirst4(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 font-mono"
              />
            </label>
            <label className="block text-sm text-[var(--fog)]" htmlFor="last4">
              Last 4
              <Input
                id="last4"
                value={last4}
                onChange={(e) => setLast4(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 font-mono"
              />
            </label>
            {localError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {localError}
              </p>
            ) : null}
          </div>
        )}
      </Frame>
    </Split>
  );
}

function useConfirmations(active: boolean, immediate: boolean) {
  const [confirms, setConfirms] = useState(immediate ? 3 : 0);

  useEffect(() => {
    if (!active || immediate) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const marks = reduce
      ? [{ n: 3, delay: 0 }]
      : [
          { n: 1, delay: 700 },
          { n: 3, delay: 1400 },
        ];
    const ids = marks.map((mark) => window.setTimeout(() => setConfirms(mark.n), mark.delay));
    return () => {
      for (const id of ids) window.clearTimeout(id);
    };
  }, [active, immediate]);

  const shown = active ? confirms : 0;
  const label = shown >= 3 ? "landed" : shown >= 1 ? "seen" : "in traffic";
  return { confirms: shown, label };
}

function ReceiptScene({
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [query, setQuery] = useState(review ? practice.txid : "");
  const [found, setFound] = useState(review);
  const [localError, setLocalError] = useState<string | null>(null);
  const { confirms, label } = useConfirmations(found, review);

  useEffect(() => {
    publish("receipt-found", found);
    publish("receipt-confirms", confirms);
  }, [found, confirms]);

  function search() {
    if (query.trim().toLowerCase() !== practice.txid) {
      setFound(false);
      setLocalError("Paste the full receipt number from the client.");
      return;
    }
    setLocalError(null);
    setFound(true);
  }

  function confirm() {
    if (!found || confirms < 3) {
      setLocalError("Wait until it says landed.");
      return;
    }
    onCommit({ txid: practice.txid });
  }

  useFootPrimary(
    review ? null : found ? (
      <Button size="lg" disabled={busy || confirms < 3} onClick={confirm}>
        {button}
      </Button>
    ) : (
      <Button size="lg" disabled={busy} onClick={search}>
        Look it up
      </Button>
    ),
    [review, found, busy, button, confirms, query],
  );

  return (
    <Split
      coach={coach}
    >
      <Frame title="CLIENT'S RECEIPT">
        <CopyChip value={practice.txid} label="receipt transaction id" />
        <p className="mt-3 text-sm text-[var(--mute)]">
          Tap to copy, then paste into the receipt field below. Amount on the way:{" "}
          {practice.receivedLabel}
        </p>
      </Frame>
      <Frame title="RECEIPT">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[var(--mute)]">Amount</dt>
            <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--paper)]">
              {found ? practice.receivedLabel : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--mute)]">Confirmations</dt>
            <dd
              className={cn(
                "mt-1",
                found && confirms >= 3 ? "text-[var(--go)]" : "text-[var(--fog)]",
              )}
            >
              {found ? `${confirms} · ${label}` : "Paste the receipt number"}
            </dd>
          </div>
        </dl>
      </Frame>
      {review ? (
        <p className="text-sm text-[var(--go)]">Landed. You checked it yourself.</p>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-[var(--fog)]" htmlFor="receipt">
            Receipt number
            <Input
              id="receipt"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 font-mono text-xs"
            />
          </label>
          {localError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {localError}
            </p>
          ) : null}
        </div>
      )}
    </Split>
  );
}

function SwapScene({
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [pasted, setPasted] = useState(review);

  useEffect(() => {
    publish("swap-pasted", pasted || review);
  }, [pasted, review]);
  const intendedEnd = practice.dest.slice(-4);
  const pastedEnd = practice.swapped.slice(-4);

  useFootPrimary(
    review ? null : pasted ? (
      <Button size="lg" disabled={busy} onClick={() => onCommit()}>
        {button}
      </Button>
    ) : (
      <Button size="lg" onClick={() => setPasted(true)}>
        Paste address
      </Button>
    ),
    [review, pasted, busy, button],
  );

  return (
    <Split
      coach={coach}
    >
      <Frame title="SEND BACK TO">
        <CopyChip value={practice.dest} label="destination address" />
        <p className="mt-2 text-sm text-[var(--mute)]">
          Start {practice.dest.slice(0, 4)} · end {intendedEnd}
        </p>
      </Frame>
      <Frame title={pasted || review ? "PASTED — CHECK THE END" : "PASTE"}>
        {pasted || review ? (
          <>
            <p className="break-all font-mono text-sm text-[var(--paper)]">
              {practice.swapped.slice(0, -4)}
              <span className="text-[var(--danger)]">{pastedEnd}</span>
            </p>
            <p className="mt-3 text-sm text-[var(--fog)]">
              Start still matches. End should be {intendedEnd}. This one ends in {pastedEnd}.
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--mute)]">Nothing pasted yet.</p>
        )}
      </Frame>
      {review ? <p className="text-sm text-[var(--go)]">You rejected the swapped ending.</p> : null}
    </Split>
  );
}

function FeeScene({
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [pace, setPace] = useState<"slow" | "fast" | null>(review ? "slow" : null);

  useEffect(() => {
    publish("fee-pace", pace ?? "none");
  }, [pace]);
  const amount = Number(practice.sendBtc);
  const fee = pace === "fast" ? practice.fastFee : pace === "slow" ? practice.slowFee : 0;
  const total = amount + fee;
  const fits = pace === "slow" && total <= practice.balance;
  const satsHint = Math.round(Number(practice.sendBtc) * 100_000_000);

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy || !fits} onClick={() => onCommit({ pace: "slow" })}>
        {button}
      </Button>
    ),
    [review, busy, button, fits],
  );

  return (
    <Split coach={coach}>
      <Frame title="THE SEND">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--mute)]">Balance</dt>
            <dd className="text-[var(--paper)]">{practice.receivedLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--mute)]">Amount</dt>
            <dd className="text-[var(--paper)]">{practice.sendBtc} BTC</dd>
          </div>
          <div>
            <dt className="text-[var(--mute)]">Toll</dt>
            <dd className="text-[var(--paper)]">{pace ? `${fee} BTC` : "Pick a pace"}</dd>
          </div>
          <div>
            <dt className="text-[var(--mute)]">Total</dt>
            <dd className="text-[var(--paper)]">{pace ? `${total.toFixed(4)} BTC` : "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-[var(--mute)]">
          {practice.sendBtc} BTC is {satsHint.toLocaleString()} sats. 1 BTC = 100 million sats.
        </p>
      </Frame>
      {review ? (
        <p className="text-sm text-[var(--go)]">Slower pace. The toll fits.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              variant={pace === "slow" ? "default" : "secondary"}
              onClick={() => setPace("slow")}
            >
              Slower, cheaper
            </Button>
            <Button
              variant={pace === "fast" ? "default" : "secondary"}
              onClick={() => setPace("fast")}
            >
              Faster, costs more
            </Button>
          </div>
          {pace === "fast" ? (
            <p className="text-sm text-[var(--danger)]">Leave room for the toll.</p>
          ) : null}
        </div>
      )}
    </Split>
  );
}

function SendScene({
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [sent, setSent] = useState(review);
  const { confirms, label } = useConfirmations(sent, review);

  useEffect(() => {
    publish("send-sent", sent);
    publish("send-confirms", confirms);
  }, [sent, confirms]);
  const [localError, setLocalError] = useState<string | null>(null);

  function confirm() {
    if (confirms < 3) {
      setLocalError("Wait until the receipt says landed.");
      return;
    }
    onCommit();
  }

  useFootPrimary(
    review ? null : sent ? (
      <Button size="lg" disabled={busy || confirms < 3} onClick={confirm}>
        {button}
      </Button>
    ) : (
      <Button size="lg" onClick={() => setSent(true)}>
        Send the test anyway
      </Button>
    ),
    [review, sent, busy, button, confirms],
  );

  return (
    <Split coach={coach}>
      <Frame title="RECEIPT">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[var(--mute)]">Amount</dt>
            <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--paper)]">
              {sent ? `${practice.sendBtc} BTC` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--mute)]">Confirmations</dt>
            <dd
              className={cn(
                "mt-1",
                sent && confirms >= 3 ? "text-[var(--go)]" : "text-[var(--fog)]",
              )}
            >
              {sent ? `${confirms} · ${label}` : "Send to start the clock"}
            </dd>
          </div>
        </dl>
      </Frame>
      {review ? (
        <p className="text-sm text-[var(--go)]">Test send landed.</p>
      ) : (
        <div className="space-y-3">
          {!sent ? <p className="text-[var(--fog)]">No undo. Send the test anyway?</p> : null}
          {localError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {localError}
            </p>
          ) : null}
        </div>
      )}
    </Split>
  );
}

function KeyScene({
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [sharedAddress, setSharedAddress] = useState(review);
  const [sharedKey, setSharedKey] = useState(review);

  useEffect(() => {
    publish("key-address", sharedAddress);
    publish("key-key", sharedKey);
  }, [sharedAddress, sharedKey]);
  const both = sharedAddress && sharedKey;

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy || !both} onClick={() => onCommit()}>
        {button}
      </Button>
    ),
    [review, busy, button, both],
  );

  return (
    <Split
      coach={coach}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Frame title="SHARE THE ADDRESS">
          <p className="text-sm text-[var(--fog)]">The plate. Safe to give the client.</p>
          {sharedAddress ? (
            <p className="mt-4 text-[var(--go)]">A coin arrived.</p>
          ) : (
            <Button className="mt-4" variant="secondary" onClick={() => setSharedAddress(true)}>
              Share address
            </Button>
          )}
        </Frame>
        <Frame title="SHARE THE KEY">
          <p className="text-sm text-[var(--fog)]">The car key. Anyone who has it can drive.</p>
          {sharedKey ? (
            <p className="mt-4 text-[var(--danger)]">The wallet is empty.</p>
          ) : (
            <Button className="mt-4" variant="secondary" onClick={() => setSharedKey(true)}>
              Share key
            </Button>
          )}
        </Frame>
      </div>
    </Split>
  );
}

function SeedScene({
  practice,
  review,
  busy,
  coach,
  onCommit,
}: {
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const words = practice.words;
  const recall = practice.recallPositions;
  const [phase, setPhase] = useState<"write" | "photo" | "chat" | "recall" | "ready">(
    review ? "ready" : "write",
  );
  const [picked, setPicked] = useState<number[]>(review ? words.map((_, i) => i) : []);
  const [recallAt, setRecallAt] = useState(0);
  const [hitIdx, setHitIdx] = useState<number | null>(null);
  const promptRef = useRef<HTMLParagraphElement>(null);
  const focusedRound = useRef(-1);

  useEffect(() => {
    publish("seed-picked", review ? 12 : picked.length);
    publish("seed-phase", review ? "ready" : phase);
  }, [review, picked.length, phase]);
  const [localError, setLocalError] = useState<string | null>(null);
  const shuffled = useMemo(() => [5, 2, 8, 0, 11, 3, 6, 1, 9, 4, 7, 10], []);

  // Land focus on each recall prompt — entering the phase and every advance —
  // so keyboard and screen-reader users start the round on the instruction.
  useEffect(() => {
    if (phase !== "recall" || focusedRound.current === recallAt) return;
    focusedRound.current = recallAt;
    promptRef.current?.focus({ preventScroll: true });
  }, [phase, recallAt]);

  useEffect(() => {
    if (hitIdx === null) return;
    const t = window.setTimeout(() => setHitIdx(null), 350);
    return () => window.clearTimeout(t);
  }, [hitIdx]);

  function tapWrite(index: number) {
    if (index !== picked.length) {
      setLocalError(`Order matters. Next is word ${picked.length + 1}.`);
      return;
    }
    setLocalError(null);
    setPicked((prev) => [...prev, index]);
  }

  function tapRecall(index: number) {
    const want = recall[recallAt] - 1;
    if (index !== want) {
      setLocalError(`That's not word ${recall[recallAt]}.`);
      return;
    }
    setLocalError(null);
    setHitIdx(index);
    if (recallAt === recall.length - 1) {
      onCommit({
        recallWords: recall.map((n) => words[n - 1]),
      });
      return;
    }
    setRecallAt((n) => n + 1);
  }

  useFootPrimary(
    review || phase === "ready" || phase === "recall"
      ? null
      : phase === "write" ? (
          <Button size="lg" disabled={picked.length !== 12} onClick={() => setPhase("photo")}>
            Card is written
          </Button>
        ) : phase === "photo" ? (
          <Button size="lg" onClick={() => setPhase("chat")}>
            Don&apos;t save
          </Button>
        ) : phase === "chat" ? (
          <Button
            size="lg"
            onClick={() => {
              setLocalError(null);
              setPhase("recall");
            }}
          >
            Refuse
          </Button>
        ) : null,
    [review, phase, picked.length],
  );

  return (
    <Split
      coach={coach}
    >
      {phase === "ready" || review ? (
        <Frame title="PAPER CARD">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {words.map((word, i) => (
              <li
                key={word}
                className="rounded-lg border border-[var(--lane)] px-3 py-2 text-sm text-[var(--paper)]"
              >
                <span className="mr-2 text-[var(--mute)]">{i + 1}</span>
                {word}
              </li>
            ))}
          </ol>
        </Frame>
      ) : null}

      {phase === "write" ? (
        <Frame title="TAP ONTO THE CARD, IN ORDER">
          <div className="flex flex-wrap gap-2">
            {words.map((word, i) => (
              <Button
                key={word}
                variant={picked.includes(i) ? "default" : "secondary"}
                disabled={picked.includes(i)}
                onClick={() => tapWrite(i)}
              >
                {word}
              </Button>
            ))}
          </div>
          <ol className="mt-4 grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <li
                key={i}
                className="rounded-lg border border-[var(--lane)] px-2 py-2 text-sm text-[var(--paper)]"
              >
                <span className="mr-1 text-[var(--mute)]">{i + 1}</span>
                {picked[i] === undefined ? "—" : words[picked[i]]}
              </li>
            ))}
          </ol>
        </Frame>
      ) : null}

      {phase === "photo" ? (
        <Frame title="YOUR PHONE ASKS">
          <p className="text-[var(--paper)]">Save these words to photos?</p>
        </Frame>
      ) : null}

      {phase === "chat" ? (
        <Frame title="A CHAT POPS UP">
          <p className="text-[var(--paper)]">Support: send word 3 so we can verify the account.</p>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setLocalError("Refuse. Those words are the wallet.");
              }}
            >
              Send word 3
            </Button>
          </div>
        </Frame>
      ) : null}

      {phase === "recall" ? (
        <Frame title="THE CARD IS HIDDEN">
          <p
            key={recallAt}
            ref={promptRef}
            tabIndex={-1}
            className="d-recall-prompt d-prompt-in"
            aria-live="polite"
          >
            Tap word <span className="d-recall-num">{recall[recallAt]}</span>
          </p>
          <div key={`dots-${recallAt}`} className="d-recall-dots" aria-hidden="true">
            {recall.map((_, d) => (
              <span
                key={d}
                className={
                  d < recallAt
                    ? "d-recall-dot d-recall-dot-done"
                    : d === recallAt
                      ? "d-recall-dot d-recall-dot-current"
                      : "d-recall-dot"
                }
              />
            ))}
          </div>
          <p className="d-recall-progress">
            Word {recallAt + 1} of {recall.length}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {shuffled.map((index) => (
              <Button
                key={words[index]}
                variant="secondary"
                className={hitIdx === index ? "d-recall-hit" : undefined}
                onClick={() => tapRecall(index)}
              >
                {words[index]}
              </Button>
            ))}
          </div>
        </Frame>
      ) : null}

      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      {busy ? <p className="text-sm text-[var(--mute)]">Saving…</p> : null}
    </Split>
  );
}

function QuickCheckView({ check }: { check: QuickCheck }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <Frame title="QUICK CHECK">
      <p className="text-sm text-[var(--fog)]">{check.question}</p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label={check.question}>
        {check.options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={picked === i}
            onClick={() => setPicked(i)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
              picked === i && i === check.answerIndex &&
                "border-[var(--go)]/60 bg-[var(--go)]/10 text-[var(--paper)]",
              picked === i && i !== check.answerIndex &&
                "border-[var(--danger)]/60 bg-[var(--danger)]/10 text-[var(--paper)]",
              picked === null &&
                "border-[var(--lane)] bg-[var(--cabin)] text-[var(--fog)] hover:border-[var(--amber)]/60",
              picked !== null &&
                picked !== i &&
                "border-[var(--lane)] bg-[var(--cabin)] text-[var(--mute)]",
            )}
          >
            {picked === i ? (
              <span
                aria-hidden="true"
                className={cn(
                  "shrink-0 text-base font-bold leading-none",
                  i === check.answerIndex ? "text-[var(--go)]" : "text-[var(--danger)]",
                )}
              >
                {i === check.answerIndex ? "✓" : "✗"}
              </span>
            ) : null}
            <span>{opt}</span>
          </button>
        ))}
      </div>
      {picked !== null ? (
        <p
          className={cn(
            "mt-3 text-sm",
            picked === check.answerIndex ? "text-[var(--go)]" : "text-[var(--danger)]",
          )}
        >
          {picked === check.answerIndex ? "Correct. " : "Not quite. "}
          <span className="text-[var(--fog)]">{check.explanation}</span>
        </p>
      ) : null}
    </Frame>
  );
}

const POLICY_SCENARIOS = [
  { id: "coffee", label: "Coffee, $4, in person", detail: "Small amount, face to face." },
  {
    id: "laptop",
    label: "Laptop, $1,800, shipped to a new customer",
    detail: "Goods ship before any dispute.",
  },
  {
    id: "house",
    label: "House deposit, $200,000, wire replacement",
    detail: "Irreversible, life-changing sum.",
  },
] as const;
const POLICY_OPTIONS = [0, 1, 3, 6, 12] as const;

type PolicyId = (typeof POLICY_SCENARIOS)[number]["id"];

function PolicyScene({
  step,
  review,
  busy,
  onCommit,
}: {
  step: Step;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [picks, setPicks] = useState<Record<PolicyId, string>>({ coffee: "", laptop: "", house: "" });
  const [custom, setCustom] = useState<Record<PolicyId, string>>({
    coffee: "",
    laptop: "",
    house: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  function threshold(id: PolicyId): number | null {
    const raw = (picks[id] === "custom" ? custom[id] : picks[id]).trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }

  function submit() {
    const coffee = threshold("coffee");
    const laptop = threshold("laptop");
    const house = threshold("house");
    if (coffee === null || coffee !== POLICY_THRESHOLDS.coffee) {
      setLocalError("A $4 in-person coffee doesn't need confirmations. Zero is the professional call.");
      return;
    }
    if (
      laptop === null ||
      laptop < POLICY_THRESHOLDS.laptopMin ||
      laptop > POLICY_THRESHOLDS.laptopMax
    ) {
      setLocalError("A $1,800 shipped laptop to a new customer needs one to three confirmations.");
      return;
    }
    if (house === null || house < POLICY_THRESHOLDS.houseMin) {
      setLocalError("For a $200,000 irreversible payment, six confirmations is the floor. Try again.");
      return;
    }
    setLocalError(null);
    onCommit({ policyCoffee: coffee, policyLaptop: laptop, policyHouse: house });
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={submit}>
        {step.button}
      </Button>
    ),
    [review, busy, step.button, picks, custom],
  );

  return (
    <Split
      coach={step.coachLine}
    >
      <IdeaPanel step={step} />
      <Frame title="YOUR POLICY">
        {review ? (
          <p className="text-sm text-[var(--go)]">Policy recorded: coffee 0 · laptop 1–3 · house 6+.</p>
        ) : (
          <div className="space-y-5">
            {POLICY_SCENARIOS.map((s) => (
              <fieldset key={s.id}>
                <legend className="text-sm text-[var(--fog)]">
                  {s.label} <span className="text-[var(--mute)]">— {s.detail}</span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {POLICY_OPTIONS.map((o) => (
                    <label
                      key={o}
                      className="flex items-center gap-2 rounded-xl border border-[var(--lane)] px-3 py-2 text-sm text-[var(--paper)]"
                    >
                      <input
                        type="radio"
                        name={`policy-${s.id}`}
                        aria-label={`${s.label}: ${o} confirmation${o === 1 ? "" : "s"}`}
                        checked={picks[s.id] === String(o)}
                        onChange={() => setPicks((p) => ({ ...p, [s.id]: String(o) }))}
                      />
                      {o}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--lane)] px-3 py-2 text-sm text-[var(--paper)]">
                    <input
                      type="radio"
                      name={`policy-${s.id}`}
                      aria-label={`${s.label}: custom`}
                      checked={picks[s.id] === "custom"}
                      onChange={() => setPicks((p) => ({ ...p, [s.id]: "custom" }))}
                    />
                    Custom
                  </label>
                  {picks[s.id] === "custom" ? (
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="w-24"
                      aria-label={`${s.label}: custom confirmations`}
                      value={custom[s.id]}
                      onChange={(e) => setCustom((c) => ({ ...c, [s.id]: e.target.value }))}
                    />
                  ) : null}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </Frame>
      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      {step.quickCheck ? <QuickCheckView check={step.quickCheck} /> : null}
    </Split>
  );
}

const CUSTODY_CARDS = [
  {
    id: "exchange",
    name: "Exchange",
    rows: [
      ["Who can spend", "The exchange"],
      ["Who can lose", "The exchange"],
      ["Who can be subpoenaed", "The exchange"],
      ["If a holder dies", "The account holder's estate needs a court order"],
    ],
  },
  {
    id: "self-custody",
    name: "Self-custody",
    rows: [
      ["Who can spend", "Only you"],
      ["Who can lose", "Only you"],
      ["Who can be subpoenaed", "Nobody — nothing to subpoena"],
      ["If a holder dies", "Seed phrase or coins gone"],
    ],
  },
  {
    id: "institutional",
    name: "Institutional custodian",
    rows: [
      ["Who can spend", "The custodian, under contract"],
      ["Who can lose", "The custodian (with insurance)"],
      ["Who can be subpoenaed", "The custodian"],
      ["If a holder dies", "The contract names a successor"],
    ],
  },
  {
    id: "multi-sig",
    name: "Multi-sig",
    rows: [
      ["Who can spend", "M of N key holders"],
      ["Who can lose", "No single key holder"],
      ["Who can be subpoenaed", "Each key holder, individually"],
      ["If a holder dies", "The remaining holders can still spend"],
    ],
  },
] as const;

function CompareScene({
  step,
  review,
  busy,
  onCommit,
}: {
  step: Step;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>(review ? [...CUSTODY_MODELS] : []);
  const [pick, setPick] = useState(review ? "multi-sig" : "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const toggleRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (spotlight === null) return;
    const t = window.setTimeout(() => setSpotlight(null), 700);
    return () => window.clearTimeout(t);
  }, [spotlight]);

  function toggle(id: string) {
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  }

  function submit() {
    const missing = CUSTODY_MODELS.find((m) => !expanded.includes(m));
    if (missing) {
      setLocalError("Expand all four models first.");
      // Pull eye and keyboard to the next needed card: ring it once and
      // focus its toggle (focus scrolls it into view when below the fold).
      setSpotlight(missing);
      toggleRefs.current[missing]?.focus();
      return;
    }
    if (pick !== "multi-sig") {
      setLocalError("Multi-sig is the only model where no single person can lose the funds alone.");
      return;
    }
    setLocalError(null);
    onCommit({ comparedModels: [...expanded], modelPick: pick });
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={submit}>
        {step.button}
      </Button>
    ),
    [review, busy, step.button, expanded, pick],
  );

  return (
    <Split
      coach={step.coachLine}
    >
      <IdeaPanel step={step} />
      {review ? (
        <Frame title="COMPARED">
          <p className="text-sm text-[var(--go)]">
            Compared all four. Multi-sig removes single-key-holder risk.
          </p>
        </Frame>
      ) : (
        <>
          <div className="space-y-3">
            {CUSTODY_CARDS.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border border-[var(--lane)] bg-[var(--cabin)]${spotlight === m.id ? " d-focus-ring" : ""}`}
              >
                <button
                  type="button"
                  ref={(el) => {
                    toggleRefs.current[m.id] = el;
                  }}
                  aria-expanded={expanded.includes(m.id)}
                  aria-controls={`custody-${m.id}`}
                  onClick={() => toggle(m.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm text-[var(--paper)]"
                >
                  {m.name}
                  <span aria-hidden="true" className="text-[var(--mute)]">
                    {expanded.includes(m.id) ? "−" : "+"}
                  </span>
                </button>
                {expanded.includes(m.id) ? (
                  <dl id={`custody-${m.id}`} className="space-y-2 px-5 pb-4 text-sm">
                    {m.rows.map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                        <dt className="shrink-0 text-[var(--mute)] sm:w-40">{k}</dt>
                        <dd className="text-[var(--fog)]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ))}
          </div>
          <Frame title="ONE QUESTION">
            <fieldset>
              <legend className="text-sm text-[var(--fog)]">
                Which model removes single-key-holder failure risk without a third party?
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CUSTODY_CARDS.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 rounded-xl border border-[var(--lane)] px-3 py-2 text-sm text-[var(--paper)]"
                  >
                    <input
                      type="radio"
                      name="custody-pick"
                      checked={pick === m.id}
                      onChange={() => setPick(m.id)}
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </Frame>
        </>
      )}
      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      {step.quickCheck ? <QuickCheckView check={step.quickCheck} /> : null}
    </Split>
  );
}

const FEE_SCENARIOS = [
  { id: "payroll", label: "Payroll batch", detail: "40 recipients, run tonight, no deadline" },
  { id: "supplier", label: "Single supplier payment", detail: "Must land within 1 hour" },
] as const;
const FEE_TIERS = [
  { id: "economy", label: "Economy", detail: "Slow and cheap — batch it" },
  { id: "standard", label: "Standard", detail: "Next few blocks" },
  { id: "priority", label: "Priority", detail: "Next block, top bidder" },
] as const;

type FeeScenarioId = (typeof FEE_SCENARIOS)[number]["id"];

function FeeStrategyScene({
  step,
  review,
  busy,
  onCommit,
}: {
  step: Step;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [picks, setPicks] = useState<Record<FeeScenarioId, string>>({ payroll: "", supplier: "" });
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    if (picks.payroll !== FEE_STRATEGY.payroll || picks.supplier !== FEE_STRATEGY.supplier) {
      setLocalError(
        "The supplier deadline justifies the priority fee. The payroll batch can wait for economy.",
      );
      return;
    }
    setLocalError(null);
    onCommit({ feePayroll: picks.payroll, feeSupplier: picks.supplier });
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={submit}>
        {step.button}
      </Button>
    ),
    [review, busy, step.button, picks],
  );

  return (
    <Split
      coach={step.coachLine}
    >
      <IdeaPanel step={step} />
      <Frame title="YOUR STRATEGY">
        {review ? (
          <p className="text-sm text-[var(--go)]">
            Strategy recorded: payroll economy, supplier priority.
          </p>
        ) : (
          <div className="space-y-5">
            {FEE_SCENARIOS.map((s) => (
              <fieldset key={s.id}>
                <legend className="text-sm text-[var(--fog)]">
                  {s.label} <span className="text-[var(--mute)]">— {s.detail}</span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FEE_TIERS.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 rounded-xl border border-[var(--lane)] px-3 py-2 text-sm text-[var(--paper)]"
                    >
                      <input
                        type="radio"
                        name={`fee-${s.id}`}
                        aria-label={`${s.label}: ${t.label}`}
                        checked={picks[s.id] === t.id}
                        onChange={() => setPicks((p) => ({ ...p, [s.id]: t.id }))}
                      />
                      {t.label}
                      <span className="text-[var(--mute)]">— {t.detail}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </Frame>
      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      {step.quickCheck ? <QuickCheckView check={step.quickCheck} /> : null}
    </Split>
  );
}

function RestoreScene({
  step,
  practice,
  review,
  busy,
  onCommit,
}: {
  step: Step;
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [words, setWords] = useState<string[]>(() => Array(12).fill(""));
  const [localError, setLocalError] = useState<string | null>(null);
  const filled = words.filter((w) => w.trim() !== "").length;

  function setWord(i: number, value: string) {
    setWords((w) => w.map((old, j) => (j === i ? value : old)));
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const parts = e.clipboardData
      .getData("text")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    e.preventDefault();
    setWords((w) => {
      const next = [...w];
      if (parts.length >= 12) {
        for (let j = 0; j < 12; j++) next[j] = parts[j] ?? "";
      } else {
        for (let j = 0; j < parts.length && i + j < 12; j++) next[i + j] = parts[j] ?? "";
      }
      return next;
    });
  }

  function submit() {
    const bad = words.findIndex(
      (w, i) => w.trim().toLowerCase() !== practice.words[i],
    );
    if (bad >= 0) {
      setLocalError(`Word ${bad + 1} is wrong. Check your written card.`);
      return;
    }
    setLocalError(null);
    onCommit({ restoreWords: words.map((w) => w.trim()) });
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={submit}>
        {step.button}
      </Button>
    ),
    [review, busy, step.button, words],
  );

  return (
    <Split coach={step.coachLine}>
      <IdeaPanel step={step} />
      <Frame title="TWELVE WORDS, IN ORDER">
        {!review ? (
          <p className="mb-3 text-sm text-[var(--mute)]" aria-live="polite">
            {filled} of 12 words entered.
          </p>
        ) : null}
        {review ? (
          <p className="text-sm text-[var(--go)]">
            Wallet restored. Balance back: {practice.receivedLabel}.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {words.map((w, i) => (
              <label key={i} className="block text-sm text-[var(--fog)]" htmlFor={`restore-word-${i}`}>
                Word {i + 1}
                <Input
                  id={`restore-word-${i}`}
                  value={w}
                  onChange={(e) => setWord(i, e.target.value)}
                  onPaste={(e) => handlePaste(i, e)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="mt-1 font-mono"
                />
              </label>
            ))}
          </div>
        )}
      </Frame>
      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      {step.quickCheck ? <QuickCheckView check={step.quickCheck} /> : null}
    </Split>
  );
}

function ExplainScene({
  step,
  review,
  busy,
  onCommit,
}: {
  step: Step;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  function submit() {
    const err = gradeExplainText(text);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    onCommit({ explainText: text.trim() });
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={submit}>
        {step.button}
      </Button>
    ),
    [review, busy, step.button, text],
  );

  return (
    <Split coach={step.coachLine}>
      <IdeaPanel step={step} />
      <Frame title="YOUR ANSWER">
        {review ? (
          <p className="text-sm text-[var(--go)]">Case recorded.</p>
        ) : (
          <div>
            <label className="block text-sm text-[var(--fog)]" htmlFor="explain-text">
              Your three sentences
              <textarea
                id="explain-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={5}
                spellCheck={false}
                className="mt-1 w-full rounded-md border border-[var(--lane)] bg-[var(--cabin)] px-3 py-2 text-sm text-[var(--paper)] placeholder:text-[var(--mute)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--asphalt)]"
                placeholder="Why should the business accept Bitcoin?"
              />
            </label>
            <p className="mt-2 text-xs text-[var(--mute)]">
              {text.length} / 500 characters · {sentences} / 2 sentences minimum
            </p>
          </div>
        )}
      </Frame>
      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      {step.quickCheck ? <QuickCheckView check={step.quickCheck} /> : null}
    </Split>
  );
}

const EXAM_TICK_ROUNDS = 12;
const EXAM_TICK_MS = 4000;

function ExamScene({
  step,
  review,
  busy,
  onCommit,
  network,
  esploraBase,
  examSince,
}: {
  step: Step;
  review: boolean;
  busy: boolean;
  onCommit: (answer?: StepAnswer) => void;
  network: BitcoinNetwork;
  esploraBase: string;
  examSince?: string | null;
}) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fundBusy, setFundBusy] = useState(false);
  const [to, setTo] = useState("");
  const [sats, setSats] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [claim, setClaim] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pollNote, setPollNote] = useState<string | null>(null);
  const { onOpenWallet, walletSync } = useContext(RailContext);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/wallet");
    if (!res.ok) throw new Error("Could not load the wallet.");
    const data = (await res.json()) as { wallet: WalletState | null };
    if (alive.current) setWallet(data.wallet ?? null);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e: unknown) => {
        if (alive.current) setLocalError(e instanceof Error ? e.message : "Could not load.");
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    // walletSync bumps when the in-course wallet modal closes.
  }, [refresh, walletSync]);

  const readiness = useMemo(
    () => examReadiness(wallet, network, examSince ?? null),
    [wallet, network, examSince],
  );
  const examTx = wallet?.history.find((t) => t.id === readiness.examTxid) ?? null;
  const explorerUrl =
    examTx && isOnChainTx(examTx) ? explorerTxUrl(network, examTx.id, esploraBase) : null;

  async function tickToConfirm(txid: string) {
    for (let i = 0; i < EXAM_TICK_ROUNDS; i++) {
      const res = await fetch("/api/wallet/tick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txid }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        wallet?: WalletState;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not advance.");
      if (alive.current && data.wallet) setWallet(data.wallet);
      const tx = data.wallet?.history.find((t) => t.id === txid);
      if (tx?.status === "confirmed") return;
      if (alive.current) setPollNote(`Confirming… ${tx?.confirmations ?? 0}/3`);
      await new Promise((r) => setTimeout(r, EXAM_TICK_MS));
      if (!alive.current) return;
    }
    throw new Error("Still confirming — press Refresh in a moment.");
  }

  async function fund() {
    setLocalError(null);
    setFundBusy(true);
    setPollNote(null);
    try {
      const res = await fetch("/api/wallet/deposit", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        tx?: { id: string };
        wallet?: WalletState;
        error?: string;
      };
      if (!res.ok || !data.tx) throw new Error(data.error ?? "Could not receive.");
      if (alive.current && data.wallet) setWallet(data.wallet);
      await tickToConfirm(data.tx.id);
      await refresh();
    } catch (e: unknown) {
      if (alive.current) setLocalError(e instanceof Error ? e.message : "Could not receive.");
    } finally {
      if (alive.current) {
        setFundBusy(false);
        setPollNote(null);
      }
    }
  }

  async function send() {
    setLocalError(null);
    const amountSats = Number(sats);
    if (!to.trim()) {
      setLocalError("Enter a recipient address.");
      return;
    }
    if (!Number.isSafeInteger(amountSats) || amountSats <= 0) {
      setLocalError("Enter an amount in sats.");
      return;
    }
    setSendBusy(true);
    setPollNote(null);
    try {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: to.trim(), amountSats, feeTier: "standard" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        tx?: { id: string };
        wallet?: WalletState;
        error?: string;
      };
      if (!res.ok || !data.tx) throw new Error(data.error ?? "Could not send.");
      if (alive.current && data.wallet) setWallet(data.wallet);
      await tickToConfirm(data.tx.id);
      await refresh();
    } catch (e: unknown) {
      if (alive.current) setLocalError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      if (alive.current) {
        setSendBusy(false);
        setPollNote(null);
      }
    }
  }

  function submit() {
    if (!readiness.setup) {
      setLocalError("Set up your practice wallet first — create it in the wallet tab.");
      return;
    }
    if (!readiness.receive) {
      setLocalError("Receive from the faucet first — use the button above.");
      return;
    }
    if (!readiness.send) {
      setLocalError("Send a payment first — use the form above.");
      return;
    }
    if (!readiness.restore) {
      setLocalError("Restore your wallet from its 12 words first — the wallet tab proves it.");
      return;
    }
    if (!readiness.examTxid) {
      setLocalError("Receive first — there is no deposit to read back.");
      return;
    }
    if (!claim.trim()) {
      setLocalError(
        network === "regtest"
          ? "Paste the block height from the explorer tx page."
          : "Paste the first 8 characters of the deposit txid.",
      );
      return;
    }
    setLocalError(null);
    onCommit({ examTxid: readiness.examTxid, examClaim: claim.trim() });
  }

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy || loading} onClick={submit}>
        {step.button}
      </Button>
    ),
    [review, busy, loading, step.button, readiness, claim],
  );

  const doneCount = review
    ? 5
    : [readiness.setup, readiness.receive, readiness.send, readiness.restore].filter(Boolean)
        .length;

  return (
    <Split coach={step.coachLine}>
      <p className="text-sm text-[var(--mute)]" aria-live="polite">
        {doneCount} of 5 tasks done.
      </p>
      {review ? null : (
        <p className="text-sm text-[var(--fog)]">
          Only work done after opening this exam counts — earlier practice does not carry over.
          Resetting the wallet does not restart the exam.
        </p>
      )}
      <IdeaPanel step={step} />
      {loading ? (
        <Frame title="EXAM">
          <p className="text-sm text-[var(--mute)]">Loading wallet…</p>
        </Frame>
      ) : review ? (
        <Frame title="EXAM PASSED">
          <p className="text-sm text-[var(--go)]">
            All five tasks verified — wallet operated end to end.
          </p>
        </Frame>
      ) : (
        <>
          <Frame title="1 · SETUP">
            {readiness.setup && wallet ? (
              <p className="text-sm text-[var(--fog)]">
                Wallet ready —{" "}
                <span className="font-mono">{truncateMiddle(wallet.address, 6)}</span>.{" "}
                <button
                  type="button"
                  onClick={(e) => onOpenWallet(e.currentTarget)}
                  className="cursor-pointer text-[var(--amber)] hover:underline"
                >
                  Open wallet
                </button>
              </p>
            ) : (
              <p className="text-sm text-[var(--fog)]">
                No wallet yet.{" "}
                <button
                  type="button"
                  onClick={(e) => onOpenWallet(e.currentTarget)}
                  className="cursor-pointer text-[var(--amber)] hover:underline"
                >
                  Create your wallet
                </button>
                , confirm the 3 words, then close the wallet.
              </p>
            )}
          </Frame>
          <Frame title="2 · RECEIVE">
            {readiness.receive && examTx ? (
              <p className="text-sm text-[var(--fog)]">
                +{examTx.amount.toLocaleString("en-US")} sats confirmed —{" "}
                <span className="font-mono">{truncateMiddle(examTx.id, 6)}</span>
              </p>
            ) : (
              <div>
                <Button disabled={fundBusy || !readiness.setup} onClick={() => void fund()}>
                  {fundBusy ? "Receiving…" : "Receive from faucet"}
                </Button>
                <p className="mt-2 text-xs text-[var(--mute)]">
                  {network === "regtest"
                    ? "Real faucet funds on your dev chain."
                    : "Simulated faucet funds."}{" "}
                  Set up first.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--fog)]">
                  A faucet is a free-coins tap for test networks — it hands out
                  small amounts so students can practice without real money.
                  These sats become the first coins in your practice wallet:
                  open it and you will see the same balance there.
                </p>
              </div>
            )}
          </Frame>
          <Frame title="3 · SEND">
            {readiness.send ? (
              <p className="text-sm text-[var(--go)]">A send confirmed. Spend proven.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--fog)]" htmlFor="exam-to">
                    To
                  </label>
                  <Input
                    id="exam-to"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder={network === "regtest" ? "bcrt1…" : "bc1…"}
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--fog)]" htmlFor="exam-sats">
                    Amount (sats)
                  </label>
                  <Input
                    id="exam-sats"
                    value={sats}
                    onChange={(e) => setSats(e.target.value)}
                    placeholder="10000"
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Button
                    disabled={sendBusy || !readiness.receive}
                    onClick={() => void send()}
                  >
                    {sendBusy ? "Sending…" : "Send (Standard fee)"}
                  </Button>
                  <p className="mt-2 text-xs text-[var(--mute)]">
                    Standard fee · needs confirmed balance — receive first.
                  </p>
                </div>
              </div>
            )}
          </Frame>
          <Frame title="4 · RESTORE">
            {readiness.restore && wallet?.restoredAt ? (
              <p className="text-sm text-[var(--fog)]">
                Restored{" "}
                {new Date(wallet.restoredAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                .
              </p>
            ) : (
              <p className="text-sm text-[var(--fog)]">
                <button
                  type="button"
                  onClick={(e) => onOpenWallet(e.currentTarget)}
                  className="cursor-pointer text-[var(--amber)] hover:underline"
                >
                  Open wallet settings
                </button>
                , restore from your 12 words, then close the wallet.
              </p>
            )}
          </Frame>
          <Frame title="5 · READ BACK">
            {!readiness.examTxid || !examTx ? (
              <p className="text-sm text-[var(--mute)]">Complete Receive first.</p>
            ) : (
              <div className="space-y-3">
                <p className="font-mono text-sm text-[var(--fog)]">
                  {explorerUrl
                    ? truncateMiddle(examTx.id, 8)
                    : `…${examTx.id.slice(-8)} (open it in the wallet to read the rest)`}
                </p>
                {explorerUrl ? (
                  <p className="text-sm">
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--amber)]"
                    >
                      Open in explorer
                    </a>
                  </p>
                ) : (
                  <p className="text-xs text-[var(--mute)]">
                    Find this deposit in the wallet activity list and open its details.
                  </p>
                )}
                <div>
                  <label className="block text-sm text-[var(--fog)]" htmlFor="exam-claim">
                    {network === "regtest"
                      ? "Block height from the explorer tx page"
                      : "First 8 characters of the deposit txid"}
                  </label>
                  <Input
                    id="exam-claim"
                    value={claim}
                    onChange={(e) => setClaim(e.target.value)}
                    placeholder={network === "regtest" ? "850" : "abcd1234"}
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
            )}
          </Frame>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setLocalError(null);
                void refresh().catch((e: unknown) => {
                  if (alive.current)
                    setLocalError(e instanceof Error ? e.message : "Could not load.");
                });
              }}
            >
              Refresh status
            </Button>
          </div>
        </>
      )}
      {pollNote ? (
        <p className="text-sm text-[var(--mute)]" aria-live="polite">
          {pollNote}
        </p>
      ) : null}
      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      {step.quickCheck ? <QuickCheckView check={step.quickCheck} /> : null}
    </Split>
  );
}

function RoadScene({
  scene,
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  scene: "support" | "network" | "mismatch";
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  if (scene === "support") {
    return (
      <SupportRoad review={review} busy={busy} button={button} coach={coach} onCommit={onCommit} />
    );
  }
  if (scene === "network") {
    return (
      <NetworkRoad review={review} busy={busy} button={button} coach={coach} onCommit={onCommit} />
    );
  }
  return (
    <MismatchRoad
      practice={practice}
      review={review}
      busy={busy}
      button={button}
      coach={coach}
      onCommit={onCommit}
    />
  );
}

function SupportRoad({
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={() => onCommit()}>
        {button}
      </Button>
    ),
    [review, busy, button],
  );

  return (
    <Split coach={coach}>
      <Frame title="DIRECT MESSAGE">
        <p className="text-[var(--paper)]">
          Support: paste your 12 words so we can unlock the account.
        </p>
        {review ? (
          <p className="mt-4 text-sm text-[var(--go)]">Chat closed.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {localError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {localError}
              </p>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                setLocalError("Close it. Those words are the wallet.");
              }}
            >
              Paste the words
            </Button>
          </div>
        )}
      </Frame>
    </Split>
  );
}

function NetworkRoad({
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [bitcoin, setBitcoin] = useState(review);

  useEffect(() => {
    publish("network-bitcoin", bitcoin || review);
  }, [bitcoin, review]);

  useFootPrimary(
    review ? null : bitcoin ? (
      <Button size="lg" disabled={busy} onClick={() => onCommit()}>
        Continue
      </Button>
    ) : (
      <Button size="lg" onClick={() => setBitcoin(true)}>
        {button}
      </Button>
    ),
    [review, bitcoin, busy, button],
  );

  return (
    <Split coach={coach}>
      <Frame title="DEPOSIT BITCOIN">
        <p className="text-sm text-[var(--fog)]">
          Network selected:{" "}
          <span className={bitcoin || review ? "text-[var(--go)]" : "text-[var(--danger)]"}>
            {bitcoin || review ? "Bitcoin" : "Ethereum · 0x"}
          </span>
        </p>
        {review ? <p className="mt-4 text-sm text-[var(--go)]">Bitcoin selected.</p> : null}
      </Frame>
    </Split>
  );
}

function MismatchRoad({
  practice,
  review,
  busy,
  button,
  coach,
  onCommit,
}: {
  practice: PracticeSet;
  review: boolean;
  busy: boolean;
  button: string;
  coach: string;
  onCommit: (answer?: StepAnswer) => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);

  useFootPrimary(
    review ? null : (
      <Button size="lg" disabled={busy} onClick={() => onCommit()}>
        {button}
      </Button>
    ),
    [review, busy, button],
  );

  return (
    <Split
      coach={coach}
    >
      <Frame title="READY TO SEND">
        <p className="text-sm text-[var(--mute)]">You meant</p>
        <CopyChip value={practice.dest} label="intended address" className="mt-2" />
        <p className="mt-4 text-sm text-[var(--mute)]">The box shows</p>
        <p className="break-all font-mono text-sm text-[var(--paper)]">
          {practice.swapped.slice(0, -4)}
          <span className="text-[var(--danger)]">{practice.swapped.slice(-4)}</span>
        </p>
        {review ? (
          <p className="mt-4 text-sm text-[var(--go)]">Send stopped.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {localError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {localError}
              </p>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                setLocalError("The ending does not match. Stop.");
              }}
            >
              Send anyway
            </Button>
          </div>
        )}
      </Frame>
    </Split>
  );
}

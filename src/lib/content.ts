import { readFile } from "fs/promises";
import path from "path";

export type TierId = "starter" | "certified" | "vip";

export type TierFeatures = {
  /** Issue named certificate at capstone end. */
  certificate: boolean;
  /** Public /verify/[id] link with the certificate. */
  verifyLink: boolean;
  /** VIP ride-along scheduling surface. */
  liveCall: boolean;
};

export type TierSupport = {
  callLabel: string;
  callHint: string;
  qaLabel: string;
  qaHint: string;
};

export type Tier = {
  id: TierId;
  name: string;
  shortName: string;
  skuHint: string;
  priceBand: string;
  recommended?: boolean;
  whoFor: string;
  coachPitch: string;
  features: TierFeatures;
  tracks: string[];
  upgradeHint: string | null;
  support?: TierSupport;
};

export type MilestoneSpec = {
  id: string;
  title: string;
  interactiveType: string;
  successCriteria: string[];
  certModuleLabel: string;
  certMilestoneLabel: string;
};

export type LessonVisual =
  | "intro"
  | "holding"
  | "address"
  | "tx-flow"
  | "explorer"
  | "qr-deposit"
  | "withdraw"
  | "keys"
  | "mnemonic"
  | "hygiene";

export type Lesson = {
  id: string;
  number: number;
  slug: string;
  title: string;
  eyebrow: string;
  headline: string;
  coachCue: string;
  beats: string[];
  visual: LessonVisual;
  cheatSheet: string[];
  nextLabel: string;
  nextStep: string;
  milestone?: MilestoneSpec;
};

export type IntroScene =
  | "satoshi"
  | "scarce"
  | "block"
  | "halving"
  | "sats"
  | "cheques"
  | "change";
export type RoadScene = "support" | "network" | "mismatch";

export type NetworkTicket = {
  id: string;
  /** recognize: question + choices + correct index. */
  prompt?: string;
  choices?: string[];
  answer?: number;
  /** verify: withdrawal/deposit ticket + expected verdict. */
  network?: string;
  address?: string;
  amount?: string;
  verdict?: "approve" | "refuse";
  why?: string;
};

export type StepAction =
  | { type: "intro"; scene: IntroScene }
  | { type: "address-check" }
  | { type: "receipt" }
  | { type: "explorer-read"; txid: string; explorerUrl: string }
  | { type: "clipboard-mismatch" }
  | { type: "fee-room" }
  | { type: "send-confirm" }
  | { type: "key-contrast" }
  | { type: "seed-card" }
  | { type: "scene"; scene: RoadScene }
  | { type: "stuck-fix" }
  | { type: "network-pick"; mode: "recognize" | "verify"; tickets: NetworkTicket[] }
  | { type: "policy-pick" }
  | { type: "model-compare" }
  | { type: "fee-strategy" }
  | { type: "seed-restore" }
  | { type: "free-write-rubric" }
  | { type: "wallet-exam" };

export type StepCert = {
  certModuleLabel: string;
  certMilestoneLabel: string;
};

export type QuickCheck = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export type Step = {
  id: string;
  slug: string;
  /** Display headline; falls back to job when absent (all pre-capstone steps). */
  title?: string;
  job: string;
  coachLine: string;
  button: string;
  action: StepAction;
  pocketCard?: string;
  cert?: StepCert;
  quickCheck?: QuickCheck;
  ideaTitle?: string;
  ideaBody?: string;
  objective?: string;
  whyItMatters?: string;
  keyTerms?: string[];
  misconception?: string;
};

export type Drive = {
  id: string;
  slug: string;
  title: string;
  minutes: string;
  job: string;
  outcome?: string;
  steps: Step[];
};

export type TrackStatus = "ready" | "coming";

export type Track = {
  id: string;
  slug: string;
  number: number;
  title: string;
  shortTitle: string;
  status: TrackStatus;
  eyebrow: string;
  headline: string;
  summary: string;
  coachPitch: string;
  symbol: string;
  lessons: Lesson[];
  drives?: Drive[];
  comingBeats?: string[];
};

export type TierIndex = {
  brand: string;
  defaultDemoTier: TierId;
  demoLicenses: Record<string, TierId>;
  tiers: TierId[];
  note: string;
};

export type TracksIndex = {
  brand: string;
  order: string[];
  note: string;
};

const ROOT = path.join(process.cwd(), "content");

async function readJson<T>(rel: string): Promise<T> {
  const raw = await readFile(path.join(ROOT, rel), "utf8");
  return JSON.parse(raw) as T;
}

export async function getTierIndex(): Promise<TierIndex> {
  return readJson<TierIndex>("tiers/index.json");
}

export async function getTier(id: TierId): Promise<Tier> {
  return readJson<Tier>(`tiers/${id}.json`);
}

export async function getAllTiers(): Promise<Tier[]> {
  const index = await getTierIndex();
  return Promise.all(index.tiers.map((id) => getTier(id)));
}

export async function getTracksIndex(): Promise<TracksIndex> {
  return readJson<TracksIndex>("tracks/index.json");
}

export async function getTrack(slug: string): Promise<Track | null> {
  try {
    return await readJson<Track>(`tracks/${slug}.json`);
  } catch {
    return null;
  }
}

export async function getAllTracks(): Promise<Track[]> {
  const index = await getTracksIndex();
  const tracks = await Promise.all(
    index.order.map(async (slug) => {
      const track = await getTrack(slug);
      if (!track) throw new Error(`Missing track: ${slug}`);
      return track;
    }),
  );
  return tracks.sort((a, b) => a.number - b.number);
}

export async function getTracksForTier(tier: Tier): Promise<Track[]> {
  const tracks = await Promise.all(
    tier.tracks.map(async (slug) => {
      const track = await getTrack(slug);
      if (!track) throw new Error(`Missing track content: ${slug}`);
      return track;
    }),
  );
  return tracks.sort((a, b) => a.number - b.number);
}

export async function getLesson(
  trackSlug: string,
  lessonSlug: string,
): Promise<{ track: Track; lesson: Lesson } | null> {
  const track = await getTrack(trackSlug);
  if (!track) return null;
  const lesson = track.lessons.find((l) => l.slug === lessonSlug);
  if (!lesson) return null;
  return { track, lesson };
}

export type CertTarget = StepCert & { trackSlug: string };

/** One certificate target per track. A track may expose only one cert step. */
export async function getCertTarget(stepId: string): Promise<CertTarget | null> {
  const tracks = await getAllTracks();
  for (const track of tracks) {
    for (const drive of track.drives ?? []) {
      for (const step of drive.steps) {
        if (step.id === stepId && step.cert) {
          return { ...step.cert, trackSlug: track.slug };
        }
      }
    }
    for (const lesson of track.lessons) {
      if (lesson.milestone?.id === stepId) {
        return {
          trackSlug: track.slug,
          certModuleLabel: lesson.milestone.certModuleLabel,
          certMilestoneLabel: lesson.milestone.certMilestoneLabel,
        };
      }
    }
  }
  return null;
}

export async function resolveTierFromLicense(
  license: string,
): Promise<TierId | null> {
  const index = await getTierIndex();
  const key = license.trim().toUpperCase();
  const mapped = index.demoLicenses[key];
  if (mapped) return mapped;
  return null;
}

export function isValidDemoLicense(
  license: string,
  index: TierIndex,
): boolean {
  return Object.keys(index.demoLicenses).includes(license.trim().toUpperCase());
}

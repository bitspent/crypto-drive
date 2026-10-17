/** Values unique to one license. Simulated only — never a real wallet. */
export type PracticeSet = {
  address: string;
  dest: string;
  swapped: string;
  txid: string;
  receivedBtc: string;
  receivedLabel: string;
  sendBtc: string;
  balance: number;
  slowFee: number;
  fastFee: number;
  words: string[];
  /** 1-based positions to recall (always 3, 6, 9). */
  recallPositions: readonly [number, number, number];
  cheques: [number, number, number];
  chequesTotal: string;
  changeFrom: number;
  changePay: number;
  changeBack: number;
};

export type StepAnswer = {
  first4?: string;
  last4?: string;
  txid?: string;
  chequesTotal?: string;
  pace?: "slow" | "fast";
  recallWords?: string[];
  /** Explorer-read (Model A): learner reads mempool.space, no live API. */
  explorerConfirmed?: "yes" | "no";
  explorerConfirmations?: number;
  explorerFeeRate?: number;
  /** Capstone policy-pick: confirmation thresholds per scenario. */
  policyCoffee?: number;
  policyLaptop?: number;
  policyHouse?: number;
  /** Capstone model-compare: expanded model ids + comprehension pick. */
  comparedModels?: string[];
  modelPick?: string;
  /** Capstone fee-strategy: tier per scenario (economy/standard/priority). */
  feePayroll?: string;
  feeSupplier?: string;
  /** Capstone seed-restore: 12 words in order. */
  restoreWords?: string[];
    /** Capstone free-write-rubric: CFO answer text. */
  explainText?: string;
  /** Final exam: read-back target txid + pasted claim (block height / txid prefix). */
  examTxid?: string;
  examClaim?: string;
};

/** Capstone policy-pick: accepted confirmation thresholds per scenario. */
export const POLICY_THRESHOLDS = {
  coffee: 0,
  laptopMin: 1,
  laptopMax: 3,
  houseMin: 6,
} as const;

/** Capstone model-compare: custody model ids; all four must be expanded. */
export const CUSTODY_MODELS = ["exchange", "self-custody", "institutional", "multi-sig"] as const;

/** Capstone fee-strategy: expected tier per scenario. */
export const FEE_STRATEGY = { payroll: "economy", supplier: "priority" } as const;

/**
 * Capstone free-write rubric. Matching is case-insensitive with a leading
 * word boundary only: a keyword matches at the start of a word, so "settles"
 * hits "settle" and "gains" hits "gain", while "again" never hits "gain".
 * One deterministic rule for categories and disqualifiers alike.
 */
export const EXPLAIN_RUBRIC = {
  categories: {
    scarcity: ["scarce", "scarcity", "21 million", "fixed supply", "capped", "hard cap"],
    settlement: [
      "settle",
      "settlement",
      "final",
      "finality",
      "confirmed",
      "confirmation",
      "irreversible",
      "borderless",
    ],
    custody: ["custody", "custodial", "custodian", "self-custody", "keys", "hold your own", "cold storage"],
  },
  disqualifiers: [
    "price",
    "invest",
    "investment",
    "return",
    "returns",
    "profit",
    "gain",
    "gains",
    "moon",
    "bull",
    "bullish",
    "revolutionary",
    "the future",
    "guaranteed",
    "to the moon",
  ],
} as const;

function keywordHit(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`, "i").test(text);
}

/** Grade a CFO answer: ≥2 sentences, ≥2 of 3 categories, zero disqualifiers. */
export function gradeExplainText(text: string): string | null {
  const clean = text.trim();
  if (clean.length > 500) {
    return "Keep it under 500 characters.";
  }
  const sentences = clean
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length < 2) {
    return "Write at least two sentences.";
  }
  if (EXPLAIN_RUBRIC.disqualifiers.some((k) => keywordHit(clean, k))) {
    return "Remove price language. This is an operational answer, not an investment pitch.";
  }
  const hit = Object.values(EXPLAIN_RUBRIC.categories).filter((keys) =>
    keys.some((k) => keywordHit(clean, k)),
  ).length;
  if (hit < 2) {
    return "Mention what it is (settlement), why it's scarce (fixed supply), and how it's custodied. You can skip one.";
  }
  return null;
}

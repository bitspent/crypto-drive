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
};

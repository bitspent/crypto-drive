/** Shared shapes for the Bitcoin backends. No runtime imports. */

export type BitcoinNetwork = "simulated" | "signet" | "regtest";

export type FeeSource = "live" | "cached" | "fallback";

/** Fee rates in sat/vB, fastest first. */
export type FeeEstimates = {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
  minimum: number;
  source: FeeSource;
};

export type TxStatus = {
  confirmed: boolean;
  confirmations: number;
  blockHeight: number | null;
};

export type BitcoinMode = BitcoinNetwork;

/**
 * Backend contract. Route handlers program to this interface and branch on
 * `network` only where backends genuinely differ (local sim state machine
 * vs. remote polling). Anything that needs a secret stays server-side:
 * the browser never imports an implementation.
 */
export interface BitcoinProvider {
  readonly network: BitcoinNetwork;
  getFees(): Promise<FeeEstimates>;
  getAddressForSeed(seed: string): string;
  getTxStatus(txid: string): Promise<TxStatus>;
  fundAddress(address: string, amountSats: number): Promise<{ txid: string }>;
  mineBlocks(count: number): Promise<{ height: number }>;
}

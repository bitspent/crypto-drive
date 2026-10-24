/** Shared shapes for the Ethereum backends. No runtime imports. */

export type EthNetwork = "simulated" | "sepolia" | "local";

export type EthFeeSource = "live" | "cached" | "fallback";

/** Fee rates in gwei, slow first. */
export type EthFeeEstimates = {
  slow: number;
  standard: number;
  fast: number;
  source: EthFeeSource;
};

export type EthTxStatus = {
  confirmed: boolean;
  confirmations: number;
  blockNumber: number | null;
};

export type EthMode = EthNetwork;

/**
 * Backend contract, mirroring BitcoinProvider. No address derivation: there
 * is no ETH wallet in the spike, so seed-to-address lands with it if ever.
 * Anything that needs a secret stays server-side: the browser never imports
 * an implementation.
 */
export interface EthProvider {
  readonly network: EthNetwork;
  getFees(): Promise<EthFeeEstimates>;
  getTxStatus(hash: string): Promise<EthTxStatus>;
  fundAddress(address: string, amountWei: string): Promise<{ balanceWei: string }>;
  mineBlocks(count: number): Promise<{ height: number }>;
}

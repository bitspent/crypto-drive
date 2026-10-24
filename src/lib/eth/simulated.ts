import type { EthFeeEstimates, EthProvider, EthTxStatus } from "./provider";

/**
 * Simulated backend: static play-money values. Funding, mining, and status
 * are meaningless here and throw.
 */
export class SimulatedEthProvider implements EthProvider {
  readonly network = "simulated" as const;

  async getFees(): Promise<EthFeeEstimates> {
    return { slow: 1, standard: 2, fast: 5, source: "fallback" };
  }

  async getTxStatus(): Promise<EthTxStatus> {
    throw new Error("not supported");
  }

  async fundAddress(): Promise<{ balanceWei: string }> {
    throw new Error("not supported");
  }

  async mineBlocks(): Promise<{ height: number }> {
    throw new Error("not supported");
  }
}

import { addressForSeed } from "../practice-samples";
import type { BitcoinProvider, FeeEstimates, TxStatus } from "./provider";

/**
 * Simulated backend: today's behavior, unchanged. Deterministic play-money
 * data from the practice seed; transfers live in wallet history; funding
 * and mining are meaningless here and throw.
 */
export class SimulatedProvider implements BitcoinProvider {
  readonly network = "simulated" as const;

  async getFees(): Promise<FeeEstimates> {
    return {
      fastest: 5,
      halfHour: 3,
      hour: 2,
      economy: 1,
      minimum: 1,
      source: "fallback",
    };
  }

  getAddressForSeed(seed: string): string {
    // HRP "bc": identical to today's practice addresses (byte-identical mode).
    return addressForSeed(seed, "bc");
  }

  async getTxStatus(): Promise<TxStatus> {
    // Simulated confirmations advance in wallet history (see advanceTx);
    // there is no remote status to poll.
    throw new Error("not supported");
  }

  async fundAddress(): Promise<{ txid: string }> {
    throw new Error("not supported");
  }

  async mineBlocks(): Promise<{ height: number }> {
    throw new Error("not supported");
  }
}

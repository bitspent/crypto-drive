import type { EthMode, EthProvider } from "./provider";
import { ETH_OFFLINE_MESSAGE, LocalEthProvider } from "./local";
import { SepoliaProvider } from "./sepolia";
import { SimulatedEthProvider } from "./simulated";

export type { EthFeeEstimates, EthFeeSource, EthMode, EthNetwork, EthTxStatus } from "./provider";
export type { EthProvider } from "./provider";
export { ETH_OFFLINE_MESSAGE } from "./local";

let cached: { mode: EthMode; provider: EthProvider } | null = null;

/** Test-only escape hatch: the singleton is per-process, tests switch modes. */
export function resetEthProvider(): void {
  cached = null;
}

function readMode(): EthMode {
  const raw = process.env.ETH_MODE?.trim();
  if (raw === "sepolia" || raw === "local") return raw;
  return "simulated";
}

/**
 * Map a provider failure to the route outcome: missing/unreachable infra is
 * always the 503 offline message, never a technical string.
 */
export function ethFailure(e: unknown, fallback: string): { message: string; status: number } {
  const raw = e instanceof Error ? e.message : fallback;
  if (raw === ETH_OFFLINE_MESSAGE || raw.startsWith("INFRA_") || raw.startsWith("ETH_")) {
    return { message: ETH_OFFLINE_MESSAGE, status: 503 };
  }
  return { message: raw, status: 400 };
}

/** Process singleton. Local/sepolia instantiation throws when env is missing. */
export function getEthProvider(): EthProvider {
  const mode = readMode();
  if (cached && cached.mode === mode) return cached.provider;
  const provider: EthProvider =
    mode === "local"
      ? new LocalEthProvider()
      : mode === "sepolia"
        ? new SepoliaProvider()
        : new SimulatedEthProvider();
  cached = { mode, provider };
  return provider;
}

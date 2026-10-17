import { FEE_TIERS, feeTiersFromRates } from "../wallet";
import type { ResolvedFeeTier } from "../wallet";
import type { BitcoinMode, BitcoinProvider } from "./provider";
import { OFFLINE_MESSAGE, RegtestProvider } from "./regtest";
import { SignetProvider } from "./signet";
import { SimulatedProvider } from "./simulated";

export type { BitcoinMode, BitcoinNetwork, FeeEstimates, FeeSource, TxStatus } from "./provider";
export type { BitcoinProvider } from "./provider";
export { OFFLINE_MESSAGE } from "./regtest";
export { pollRegtestTx } from "./poll";

let cached: { mode: BitcoinMode; provider: BitcoinProvider } | null = null;

/** Test-only escape hatch: the singleton is per-process, tests switch modes. */
export function resetBitcoinProvider(): void {
  cached = null;
}

function readMode(): BitcoinMode {
  const raw = process.env.BITCOIN_MODE?.trim();
  if (raw === "signet" || raw === "regtest") return raw;
  return "simulated";
}

/**
 * Map a provider failure to the learner-facing outcome: missing/unreachable
 * infra is always the 503 offline message, never a technical string.
 */
export function providerFailure(
  e: unknown,
  fallback: string,
): { message: string; status: number } {
  const raw = e instanceof Error ? e.message : fallback;
  if (raw === OFFLINE_MESSAGE || raw.startsWith("INFRA_")) {
    return { message: OFFLINE_MESSAGE, status: 503 };
  }
  return { message: raw, status: 400 };
}

/** Process singleton. Regtest instantiation throws when infra env is missing. */
export function getBitcoinProvider(): BitcoinProvider {
  const mode = readMode();
  if (cached && cached.mode === mode) return cached.provider;
  const provider: BitcoinProvider =
    mode === "regtest"
      ? new RegtestProvider()
      : mode === "signet"
        ? new SignetProvider()
        : new SimulatedProvider();
  cached = { mode, provider };
  return provider;
}

/**
 * Fee tiers for the active mode. Simulated returns today's static tiers
 * verbatim; live modes map provider estimates onto the same tier shape and
 * fall back to static tiers when the network call fails.
 */
export async function getActiveFeeTiers(): Promise<ResolvedFeeTier[]> {
  const provider = getBitcoinProvider();
  if (provider.network === "simulated") return [...FEE_TIERS];
  try {
    const fees = await provider.getFees();
    return feeTiersFromRates({
      fastest: fees.fastest,
      halfHour: fees.halfHour,
      economy: fees.economy,
    });
  } catch {
    return [...FEE_TIERS];
  }
}

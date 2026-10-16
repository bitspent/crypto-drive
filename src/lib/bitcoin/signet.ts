import { addressForSeed } from "../practice-samples";
import type { BitcoinProvider, FeeEstimates, TxStatus } from "./provider";

const MEMPOOL_SIGNET = "https://mempool.space/signet/api";
const BLOCKSTREAM_SIGNET = "https://blockstream.info/signet/api";
const FEE_CACHE_MS = 60_000;

type Recommended = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
};

/**
 * Signet backend: live fees and live tx lookups, no funding or mining.
 * Transfers stay simulated (the provider has no faucet); only fee rates
 * and confirmation reads touch the network.
 */
export class SignetProvider implements BitcoinProvider {
  readonly network = "signet" as const;
  private feeCache: { at: number; value: FeeEstimates } | null = null;

  async getFees(): Promise<FeeEstimates> {
    const now = Date.now();
    if (this.feeCache && now - this.feeCache.at < FEE_CACHE_MS) {
      return { ...this.feeCache.value, source: "cached" };
    }
    try {
      const res = await fetch(`${MEMPOOL_SIGNET}/v1/fees/recommended`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`fees ${res.status}`);
      const r = (await res.json()) as Recommended;
      const value: FeeEstimates = {
        fastest: r.fastestFee,
        halfHour: r.halfHourFee,
        hour: r.hourFee,
        economy: r.economyFee,
        minimum: r.minimumFee,
        source: "live",
      };
      this.feeCache = { at: now, value };
      return value;
    } catch {
      return this.fallbackFees();
    }
  }

  private async fallbackFees(): Promise<FeeEstimates> {
    const res = await fetch(`${BLOCKSTREAM_SIGNET}/fee-estimates`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`fee fallback ${res.status}`);
    const est = (await res.json()) as Record<string, number>;
    const at = (blocks: number): number => Math.max(1, Math.round(est[String(blocks)] ?? 1));
    return {
      fastest: at(1),
      halfHour: at(3),
      hour: at(6),
      economy: at(144),
      minimum: 1,
      source: "fallback",
    };
  }

  getAddressForSeed(seed: string): string {
    return addressForSeed(seed, "tb");
  }

  async getTxStatus(txid: string): Promise<TxStatus> {
    const res = await fetch(`${MEMPOOL_SIGNET}/tx/${txid}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) throw new Error("tx not found");
    if (!res.ok) throw new Error(`tx ${res.status}`);
    const tx = (await res.json()) as {
      status?: { confirmed?: boolean; block_height?: number };
    };
    const confirmed = tx.status?.confirmed === true;
    const blockHeight = tx.status?.block_height ?? null;
    if (!confirmed || blockHeight === null) {
      return { confirmed: false, confirmations: 0, blockHeight: null };
    }
    const tipRes = await fetch(`${MEMPOOL_SIGNET}/blocks/tip/height`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!tipRes.ok) throw new Error(`tip ${tipRes.status}`);
    const tip = Number(await tipRes.text());
    return {
      confirmed: true,
      confirmations: Math.max(1, tip - blockHeight + 1),
      blockHeight,
    };
  }

  async fundAddress(): Promise<{ txid: string }> {
    throw new Error("not supported");
  }

  async mineBlocks(): Promise<{ height: number }> {
    throw new Error("not supported");
  }
}

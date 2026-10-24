import type { EthFeeEstimates, EthProvider, EthTxStatus } from "./provider";

const FEE_CACHE_MS = 60_000;

const hexToBig = (h: string): bigint => BigInt(h);
const gweiOf = (wei: bigint): number => Number(wei) / 1e9;

/**
 * Sepolia backend: live fees and live tx lookups against ETH_RPC_URL — no
 * funding or mining. Unlike the signet provider there is no reliable keyless
 * default RPC, so the URL is required and documented in .env.example.
 */
export class SepoliaProvider implements EthProvider {
  readonly network = "sepolia" as const;
  private readonly rpcUrl: string;
  private feeCache: { at: number; value: EthFeeEstimates } | null = null;

  constructor() {
    const rpcUrl = process.env.ETH_RPC_URL?.trim();
    if (!rpcUrl) {
      throw new Error("ETH_RPC_URL must be set for ETH_MODE=sepolia.");
    }
    this.rpcUrl = rpcUrl;
  }

  private async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "drive", method, params }),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => null)) as {
      result?: T;
      error?: { message?: string };
    } | null;
    if (!res.ok || body == null || body.error) {
      throw new Error(body?.error?.message ? `eth: ${body.error.message}` : `eth ${res.status}`);
    }
    return body.result as T;
  }

  async getFees(): Promise<EthFeeEstimates> {
    const now = Date.now();
    if (this.feeCache && now - this.feeCache.at < FEE_CACHE_MS) {
      return { ...this.feeCache.value, source: "cached" };
    }
    try {
      const history = await this.rpc<{ reward?: string[][] }>("eth_feeHistory", [
        "0x4",
        "latest",
        [25, 50, 75],
      ]);
      const last = history.reward?.[history.reward.length - 1];
      if (!last) throw new Error("empty fee history");
      const [slow, standard, fast] = last.map((h) => gweiOf(hexToBig(h)));
      const value: EthFeeEstimates = { slow, standard, fast, source: "live" };
      this.feeCache = { at: now, value };
      return value;
    } catch {
      const gasPrice = await this.rpc<string>("eth_gasPrice");
      const base = gweiOf(hexToBig(gasPrice));
      return { slow: base, standard: base, fast: base, source: "fallback" };
    }
  }

  async getTxStatus(hash: string): Promise<EthTxStatus> {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new Error("tx not found");
    }
    const receipt = await this.rpc<{ blockNumber?: string } | null>(
      "eth_getTransactionReceipt",
      [hash],
    );
    if (!receipt?.blockNumber) {
      return { confirmed: false, confirmations: 0, blockNumber: null };
    }
    const tip = Number(hexToBig(await this.rpc<string>("eth_blockNumber")));
    const at = Number(hexToBig(receipt.blockNumber));
    return {
      confirmed: true,
      confirmations: Math.max(1, tip - at + 1),
      blockNumber: at,
    };
  }

  async fundAddress(): Promise<{ balanceWei: string }> {
    throw new Error("not supported");
  }

  async mineBlocks(): Promise<{ height: number }> {
    throw new Error("not supported");
  }
}

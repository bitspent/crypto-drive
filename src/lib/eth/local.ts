import type { EthFeeEstimates, EthProvider, EthTxStatus } from "./provider";

export const ETH_OFFLINE_MESSAGE = "Local Ethereum devnet is offline. Try again in a moment.";

function logInfraFailure(event: string, detail: Record<string, unknown>): void {
  console.error(JSON.stringify({ event, network: "eth-local", ...detail }));
}

/**
 * Local backend: speaks the infra-api's /api/eth/* routes (same service and
 * Bearer [REDACTED] the regtest backend — Anvil hangs off it as a sidecar).
 * 5s timeout, one retry on 5xx. Throws at instantiation when env is missing.
 */
export class LocalEthProvider implements EthProvider {
  readonly network = "local" as const;
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly adminToken: string;

  constructor() {
    const baseUrl = process.env.INFRA_BASE_URL?.trim();
    const secret = process.env.INFRA_SHARED_SECRET?.trim();
    const adminToken = process.env.ADMIN_MINE_TOKEN?.trim();
    if (!baseUrl || !secret) {
      throw new Error(
        "INFRA_BASE_URL and INFRA_SHARED_SECRET must be set for ETH_MODE=local.",
      );
    }
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.secret = secret;
    // Mine-only, like the regtest provider: reads work without it.
    this.adminToken = adminToken ?? "";
  }

  private async call<T>(path: string, init?: RequestInit & { admin?: boolean }): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secret}`,
      ...(init?.admin ? { "X-Admin-Token": this.adminToken } : {}),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        logInfraFailure("infra.request.error", {
          path,
          attempt: attempt + 1,
          error: err instanceof Error ? err.message : String(err),
        });
        throw new Error(ETH_OFFLINE_MESSAGE);
      }
      lastStatus = res.status;
      if (res.status >= 500 && attempt === 0) continue;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 404) throw new Error(body.error || "tx not found");
        if (res.status >= 500) {
          logInfraFailure("infra.request.5xx", { path, status: res.status });
          throw new Error(ETH_OFFLINE_MESSAGE);
        }
        throw new Error(body.error || `infra ${res.status}`);
      }
      return (await res.json()) as T;
    }
    logInfraFailure("infra.request.retry.exhausted", { path, status: lastStatus });
    throw new Error(ETH_OFFLINE_MESSAGE);
  }

  async getFees(): Promise<EthFeeEstimates> {
    const fees = await this.call<Omit<EthFeeEstimates, "source">>("/api/eth/fees", {
      method: "GET",
    });
    return { ...fees, source: "live" };
  }

  async getTxStatus(hash: string): Promise<EthTxStatus> {
    return this.call<EthTxStatus>(`/api/eth/tx/${hash}`, { method: "GET" });
  }

  async fundAddress(address: string, amountWei: string): Promise<{ balanceWei: string }> {
    return this.call<{ balanceWei: string }>("/api/eth/address/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, amountWei }),
    });
  }

  async mineBlocks(count: number): Promise<{ height: number }> {
    if (!this.adminToken) {
      throw new Error("ADMIN_MINE_TOKEN must be set to mine.");
    }
    return this.call<{ height: number }>("/api/eth/mine", {
      method: "POST",
      admin: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocks: count }),
    });
  }
}

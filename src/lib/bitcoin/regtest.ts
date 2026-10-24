import { addressForSeed } from "../practice-samples";
import type { BitcoinProvider, FeeEstimates, TxStatus } from "./provider";

export const OFFLINE_MESSAGE = "Regtest infrastructure is offline. Try again in a moment.";

function logInfraFailure(event: string, detail: Record<string, unknown>): void {
  console.error(JSON.stringify({ event, network: "regtest", ...detail }));
}

/**
 * Regtest backend: speaks the self-hosted infra contract (see
 * docs/infra-contract.md) over INFRA_BASE_URL. Bearer auth on every call,
 * 5s timeout, one retry on 5xx. Throws at instantiation when env is missing.
 */
export class RegtestProvider implements BitcoinProvider {
  readonly network = "regtest" as const;
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly adminToken: string;

  constructor() {
    const baseUrl = process.env.INFRA_BASE_URL?.trim();
    const secret = process.env.INFRA_SHARED_SECRET?.trim();
    const adminToken = process.env.ADMIN_MINE_TOKEN?.trim();
    if (!baseUrl || !secret || !adminToken) {
      throw new Error(
        "INFRA_BASE_URL, INFRA_SHARED_SECRET, and ADMIN_MINE_TOKEN must be set for BITCOIN_MODE=regtest.",
      );
    }
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.secret = secret;
    this.adminToken = adminToken;
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
        throw new Error(OFFLINE_MESSAGE);
      }
      lastStatus = res.status;
      if (res.status >= 500 && attempt === 0) continue;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 404) throw new Error(body.error || "tx not found");
        if (res.status >= 500) {
          logInfraFailure("infra.request.5xx", { path, status: res.status });
          throw new Error(OFFLINE_MESSAGE);
        }
        throw new Error(body.error || `infra ${res.status}`);
      }
      return (await res.json()) as T;
    }
    logInfraFailure("infra.request.retry.exhausted", { path, status: lastStatus });
    throw new Error(OFFLINE_MESSAGE);
  }

  async getFees(): Promise<FeeEstimates> {
    const fees = await this.call<Omit<FeeEstimates, "source">>("/api/fees", { method: "GET" });
    return { ...fees, source: "live" };
  }

  getAddressForSeed(seed: string): string {
    return addressForSeed(seed, "bcrt");
  }

  async getTxStatus(txid: string): Promise<TxStatus> {
    return this.call<TxStatus>(`/api/tx/${txid}`, { method: "GET" });
  }

  async fundAddress(address: string, amountSats: number): Promise<{ txid: string }> {
    return this.call<{ txid: string }>("/api/address/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, amountSats }),
    });
  }

  async mineBlocks(count: number): Promise<{ height: number }> {
    return this.call<{ height: number }>("/api/mine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocks: count }),
      admin: true,
    });
  }
}

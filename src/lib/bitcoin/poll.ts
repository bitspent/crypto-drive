import type { BitcoinProvider, TxStatus } from "./provider";

/**
 * Poll one tx on regtest, mining a block first while it is still short of
 * the wallet's confirmation threshold. Nothing auto-mines on a dev chain,
 * so without this every deposit would sit at 0 until someone mined by hand;
 * with it, ticks walk 0 → 1 → 2 → 3 exactly like the simulated UX, except
 * the confirmations are real. Mining pays the faucet wallet, which keeps
 * the faucet topped up as a side effect.
 *
 * Failures degrade to poll-only (current behavior): a failed mine returns
 * the first poll, and "tx not found" always throws through for the caller
 * to map.
 */
export async function pollRegtestTx(
  provider: BitcoinProvider,
  txid: string,
  threshold: number,
): Promise<TxStatus> {
  const status = await provider.getTxStatus(txid);
  if (status.confirmations >= threshold) return status;
  try {
    await provider.mineBlocks(1);
  } catch (e) {
    // A 403 is a config bug (wrong/missing admin token), not a wobble:
    // surface it instead of degrading to a stuck 0.
    if (e instanceof Error && e.message === "forbidden") throw e;
    return status;
  }
  try {
    return await provider.getTxStatus(txid);
  } catch {
    return status;
  }
}

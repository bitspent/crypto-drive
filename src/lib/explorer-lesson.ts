/**
 * Famous 2010 Bitcoin pizza payment — Model A explorer lesson (deep-link only).
 * Verified on mempool.space (plan/implement pass; no runtime API in the app):
 *   https://mempool.space/tx/a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d
 *   confirmed at block 57043; fee 99_000_000 sats; vsize 23620 → ~4191 sat/vB.
 */
export const PIZZA_EXPLORER = {
  txid: "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
  explorerUrl:
    "https://mempool.space/tx/a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
  feeRateSatVb: 4191,
  feeRateMin: 4000,
  feeRateMax: 4400,
  /** Confirms only grow; floor stays safe for this 2010 mainnet tx. */
  confirmationsMin: 100_000,
} as const;

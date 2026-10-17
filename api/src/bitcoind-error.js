// Pure formatter for bitcoind JSON-RPC failures. bitcoind answers HTTP 500
// for execution errors (wallet missing, already exists, …) WITH the reason
// in body.error — that reason must survive into the thrown Error, because
// ensureWallet() in index.js recovers by matching "already exists" /
// "already loaded". A bare `bitcoind http 500` breaks fund+mine after every
// bitcoind restart (the match never hits, the wallet never reloads).
export function formatBitcoindError(status, body) {
  const msg = body?.error?.message ?? body?.error?.code;
  if (msg !== undefined && msg !== null && msg !== "") return `bitcoind: ${msg}`;
  return `bitcoind http ${status}`;
}

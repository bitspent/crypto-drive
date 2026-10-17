// api/src/bitcoind-error.js: bitcoind answers HTTP 500 for execution errors
// WITH the reason in body.error. That reason must survive into the thrown
// Error — ensureWallet() recovers by matching "already exists" /
// "already loaded", and swallowing the body 503s fund+mine forever after
// every bitcoind restart (observed live, Oct 2026).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatBitcoindError } from "../api/src/bitcoind-error.js";

describe("formatBitcoindError", () => {
  it("keeps the JSON-RPC reason on HTTP 500", () => {
    const err = formatBitcoindError(500, {
      result: null,
      error: { code: -18, message: "Requested wallet does not exist or is not loaded" },
    });
    assert.match(err, /Requested wallet does not exist/);
  });

  it("keeps 200-with-error bodies verbatim", () => {
    const err = formatBitcoindError(200, {
      result: null,
      error: { code: -4, message: "Wallet file verification failed" },
    });
    assert.match(err, /Wallet file verification failed/);
  });

  it("falls back to the HTTP status when the body is missing or bare", () => {
    assert.equal(formatBitcoindError(500, null), "bitcoind http 500");
    assert.equal(formatBitcoindError(500, {}), "bitcoind http 500");
    assert.equal(formatBitcoindError(500, { result: null }), "bitcoind http 500");
  });

  it("pins the ensureWallet recovery contract", () => {
    // api/src/index.js ensureWallet() matches these substrings to reload an
    // on-disk wallet after a restart. If formatting drops them, fund+mine
    // return 503 until a human runs loadwallet.
    const exists = formatBitcoindError(500, {
      result: null,
      error: { code: -4, message: "Wallet infra-faucet already exists." },
    });
    const loaded = formatBitcoindError(500, {
      result: null,
      error: { code: -4, message: "Wallet infra-faucet is already loaded." },
    });
    assert.match(exists, /already exists/);
    assert.match(loaded, /already loaded/);
  });
});

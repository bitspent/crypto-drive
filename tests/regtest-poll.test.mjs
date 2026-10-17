// Regtest tick polling: mines one block while the tx is short of the
// wallet threshold, degrades to poll-only on failure, never mines for
// confirmed or missing txs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/regtest-poll.test.mjs"));
const { pollRegtestTx } = jiti(join(root, "src/lib/bitcoin/poll.ts"));

function fakeProvider({ statuses, mineFails = false }) {
  const calls = { status: 0, mine: 0 };
  let i = 0;
  return {
    calls,
    provider: {
      network: "regtest",
      getTxStatus: async () => {
        calls.status += 1;
        const s = statuses[Math.min(i++, statuses.length - 1)];
        if (s instanceof Error) throw s;
        return s;
      },
      mineBlocks: async () => {
        calls.mine += 1;
        if (mineFails) throw new Error("boom");
        return { height: 100 + calls.mine };
      },
    },
  };
}

const status = (confirmations, blockHeight = 100) => ({ confirmed: confirmations > 0, confirmations, blockHeight });

describe("pollRegtestTx", () => {
  it("mines once and re-polls while short of threshold", async () => {
    const { calls, provider } = fakeProvider({ statuses: [status(0), status(1)] });
    const out = await pollRegtestTx(provider, "tx", 3);
    assert.deepEqual(out, status(1));
    assert.equal(calls.mine, 1);
    assert.equal(calls.status, 2);
  });

  it("never mines once the threshold is reached", async () => {
    const { calls, provider } = fakeProvider({ statuses: [status(5)] });
    assert.deepEqual(await pollRegtestTx(provider, "tx", 3), status(5));
    assert.equal(calls.mine, 0);
    assert.equal(calls.status, 1);
  });

  it("lets tx-not-found throw through without mining", async () => {
    const { calls, provider } = fakeProvider({ statuses: [new Error("tx not found")] });
    await assert.rejects(pollRegtestTx(provider, "tx", 3), /tx not found/);
    assert.equal(calls.mine, 0);
  });

  it("a failed mine degrades to the first poll", async () => {
    const { calls, provider } = fakeProvider({ statuses: [status(1)], mineFails: true });
    assert.deepEqual(await pollRegtestTx(provider, "tx", 3), status(1));
    assert.equal(calls.mine, 1);
    assert.equal(calls.status, 1);
  });

  it("a forbidden mine surfaces instead of degrading", async () => {
    const { provider } = fakeProvider({ statuses: [status(0)] });
    provider.mineBlocks = async () => {
      throw new Error("forbidden");
    };
    await assert.rejects(pollRegtestTx(provider, "tx", 3), /forbidden/);
  });

  it("a failed re-poll keeps the first status", async () => {
    const { calls, provider } = fakeProvider({
      statuses: [status(1), new Error("flaky")],
    });
    assert.deepEqual(await pollRegtestTx(provider, "tx", 3), status(1));
    assert.equal(calls.mine, 1);
    assert.equal(calls.status, 2);
  });
});

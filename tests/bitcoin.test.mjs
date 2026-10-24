// BitcoinProvider: selection, HRPs, regtest auth/retry, signet fallback/cache.
// Run with: node --test tests/
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/bitcoin.test.mjs"));
const bitcoin = jiti(join(root, "src/lib/bitcoin/index.ts"));
const samples = jiti(join(root, "src/lib/practice-samples.ts"));

const SEED = "test-seed-0123456789abcdef";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

describe("provider selection", () => {
  beforeEach(() => {
    bitcoin.resetBitcoinProvider();
    delete process.env.BITCOIN_MODE;
    delete process.env.INFRA_BASE_URL;
    delete process.env.INFRA_SHARED_SECRET;
    delete process.env.ADMIN_MINE_TOKEN;
  });

  it("defaults to simulated on missing or unknown mode", () => {
    assert.equal(bitcoin.getBitcoinProvider().network, "simulated");
    process.env.BITCOIN_MODE = "mainnet";
    bitcoin.resetBitcoinProvider();
    assert.equal(bitcoin.getBitcoinProvider().network, "simulated");
  });

  it("selects signet and regtest, singleton per mode", () => {
    process.env.BITCOIN_MODE = "signet";
    const a = bitcoin.getBitcoinProvider();
    const b = bitcoin.getBitcoinProvider();
    assert.equal(a.network, "signet");
    assert.equal(a, b);
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "s3cret";
    process.env.ADMIN_MINE_TOKEN = "adm1n";
    bitcoin.resetBitcoinProvider();
    assert.equal(bitcoin.getBitcoinProvider().network, "regtest");
  });

  it("regtest throws when infra env is missing", () => {
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    assert.throws(() => bitcoin.getBitcoinProvider(), /INFRA_SHARED_SECRET/);
  });

  it("regtest throws fast on an empty mine token, not later at 403", () => {
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "s3cret";
    assert.throws(() => bitcoin.getBitcoinProvider(), /ADMIN_MINE_TOKEN/);
  });
});

describe("provider addresses", () => {
  beforeEach(() => {
    bitcoin.resetBitcoinProvider();
    delete process.env.BITCOIN_MODE;
    delete process.env.INFRA_BASE_URL;
    delete process.env.INFRA_SHARED_SECRET;
  });

  it("uses bc / tb / bcrt HRPs per network", () => {
    const sim = bitcoin.getBitcoinProvider().getAddressForSeed(SEED);
    assert.match(sim, /^bc1q/);
    assert.equal(sim, samples.practiceFor(SEED).address);
    process.env.BITCOIN_MODE = "signet";
    bitcoin.resetBitcoinProvider();
    assert.match(bitcoin.getBitcoinProvider().getAddressForSeed(SEED), /^tb1q/);
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "s3cret";
    process.env.ADMIN_MINE_TOKEN = "adm1n";
    bitcoin.resetBitcoinProvider();
    assert.match(bitcoin.getBitcoinProvider().getAddressForSeed(SEED), /^bcrt1q/);
  });
});

describe("regtest client", () => {
  let realFetch;
  let calls;
  beforeEach(() => {
    bitcoin.resetBitcoinProvider();
    process.env.BITCOIN_MODE = "regtest";
    process.env.INFRA_BASE_URL = "https://infra.example.com/";
    process.env.INFRA_SHARED_SECRET = "s3cret";
    process.env.ADMIN_MINE_TOKEN = "adm1n";
    realFetch = global.fetch;
    calls = [];
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.BITCOIN_MODE;
    delete process.env.INFRA_BASE_URL;
    delete process.env.INFRA_SHARED_SECRET;
    delete process.env.ADMIN_MINE_TOKEN;
    bitcoin.resetBitcoinProvider();
  });

  it("sends Bearer auth on every call", async () => {
    global.fetch = async (url, init) => {
      calls.push([url, init]);
      return jsonResponse(200, { fastest: 5, halfHour: 3, hour: 2, economy: 1, minimum: 1 });
    };
    const fees = await bitcoin.getBitcoinProvider().getFees();
    assert.equal(fees.source, "live");
    assert.equal(fees.fastest, 5);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "https://infra.example.com/api/fees");
    assert.equal(calls[0][1].headers.Authorization, "Bearer s3cret");
  });

  it("retries once on 5xx, then reports offline", async () => {
    let n = 0;
    global.fetch = async () => (++n === 1 ? jsonResponse(500, {}) : jsonResponse(200, { fastest: 5, halfHour: 3, hour: 2, economy: 1, minimum: 1 }));
    const fees = await bitcoin.getBitcoinProvider().getFees();
    assert.equal(fees.source, "live");
    assert.equal(n, 2);
    global.fetch = async () => jsonResponse(503, {});
    await assert.rejects(bitcoin.getBitcoinProvider().getFees(), new RegExp(bitcoin.OFFLINE_MESSAGE));
  });

  it("sends the admin token when mining", async () => {
    global.fetch = async (url, init) => {
      calls.push([url, init]);
      return jsonResponse(200, { height: 42 });
    };
    const { height } = await bitcoin.getBitcoinProvider().mineBlocks(2);
    assert.equal(height, 42);
    assert.equal(calls[0][1].headers["X-Admin-Token"], "adm1n");
    assert.deepEqual(JSON.parse(calls[0][1].body), { blocks: 2 });
  });

  it("maps 404 to tx not found", async () => {
    global.fetch = async () => jsonResponse(404, { error: "tx not found" });
    await assert.rejects(bitcoin.getBitcoinProvider().getTxStatus("a".repeat(64)), /tx not found/);
  });
});

describe("signet client", () => {
  let realFetch;
  beforeEach(() => {
    bitcoin.resetBitcoinProvider();
    process.env.BITCOIN_MODE = "signet";
    realFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.BITCOIN_MODE;
    bitcoin.resetBitcoinProvider();
  });

  it("falls back to blockstream when mempool fails, then caches live reads", async () => {
    let mempoolCalls = 0;
    global.fetch = async (url) => {
      if (String(url).includes("mempool.space")) {
        mempoolCalls++;
        throw new Error("down");
      }
      return jsonResponse(200, { 1: 8, 3: 6, 6: 4, 144: 2 });
    };
    const fb = await bitcoin.getBitcoinProvider().getFees();
    assert.equal(fb.source, "fallback");
    assert.equal(fb.fastest, 8);
    assert.equal(fb.economy, 2);

    bitcoin.resetBitcoinProvider();
    mempoolCalls = 0;
    global.fetch = async () => {
      mempoolCalls++;
      return jsonResponse(200, {
        fastestFee: 9,
        halfHourFee: 7,
        hourFee: 5,
        economyFee: 3,
        minimumFee: 1,
      });
    };
    const provider = bitcoin.getBitcoinProvider();
    const first = await provider.getFees();
    const second = await provider.getFees();
    assert.equal(first.source, "live");
    assert.equal(second.source, "cached");
    assert.equal(mempoolCalls, 1);
  });

  it("computes confirmations from tip height", async () => {
    global.fetch = async (url) => {
      if (String(url).endsWith("/blocks/tip/height")) return jsonResponse(200, "110");
      return jsonResponse(200, { status: { confirmed: true, block_height: 108 } });
    };
    const status = await bitcoin.getBitcoinProvider().getTxStatus("b".repeat(64));
    assert.deepEqual(status, { confirmed: true, confirmations: 3, blockHeight: 108 });
  });

  it("throws not supported for funding and mining", async () => {
    const provider = bitcoin.getBitcoinProvider();
    await assert.rejects(provider.fundAddress("tb1qx", 1000), /not supported/);
    await assert.rejects(provider.mineBlocks(1), /not supported/);
  });
});

describe("providerFailure", () => {
  it("maps infra problems to the 503 offline message", () => {
    assert.deepEqual(bitcoin.providerFailure(new Error(bitcoin.OFFLINE_MESSAGE), "x"), {
      message: bitcoin.OFFLINE_MESSAGE,
      status: 503,
    });
    assert.deepEqual(bitcoin.providerFailure(new Error("INFRA_BASE_URL and INFRA_SHARED_SECRET must be set."), "x"), {
      message: bitcoin.OFFLINE_MESSAGE,
      status: 503,
    });
    assert.deepEqual(bitcoin.providerFailure(new Error("boom"), "fallback"), {
      message: "boom",
      status: 400,
    });
    assert.deepEqual(bitcoin.providerFailure("string", "fallback"), {
      message: "fallback",
      status: 400,
    });
  });
});

describe("active fee tiers", () => {
  beforeEach(() => {
    bitcoin.resetBitcoinProvider();
    delete process.env.BITCOIN_MODE;
  });
  afterEach(() => {
    delete process.env.BITCOIN_MODE;
    bitcoin.resetBitcoinProvider();
  });

  it("simulated resolves to the static tiers verbatim", async () => {
    const tiers = await bitcoin.getActiveFeeTiers();
    assert.deepEqual(
      tiers.map((t) => [t.id, t.satPerVb]),
      [
        ["economy", 1],
        ["standard", 5],
        ["priority", 15],
      ],
    );
  });
});

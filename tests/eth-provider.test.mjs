// EthProvider: selection, local auth/retry, sepolia RPC mapping.
// Run with: node --test tests/
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/eth-provider.test.mjs"));
const eth = jiti(join(root, "src/lib/eth/index.ts"));

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function rpcResult(result) {
  return jsonResponse(200, { jsonrpc: "2.0", id: "infra", result });
}

describe("eth provider selection", () => {
  beforeEach(() => {
    eth.resetEthProvider();
    delete process.env.ETH_MODE;
    delete process.env.ETH_RPC_URL;
    delete process.env.INFRA_BASE_URL;
    delete process.env.INFRA_SHARED_SECRET;
    delete process.env.ADMIN_MINE_TOKEN;
  });

  it("defaults to simulated on missing or unknown mode", () => {
    assert.equal(eth.getEthProvider().network, "simulated");
    process.env.ETH_MODE = "mainnet";
    eth.resetEthProvider();
    assert.equal(eth.getEthProvider().network, "simulated");
  });

  it("selects sepolia and local, singleton per mode", () => {
    process.env.ETH_MODE = "sepolia";
    process.env.ETH_RPC_URL = "https://rpc.sepolia.example";
    const a = eth.getEthProvider();
    const b = eth.getEthProvider();
    assert.equal(a.network, "sepolia");
    assert.equal(a, b);
    process.env.ETH_MODE = "local";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "dev-token";
    process.env.ADMIN_MINE_TOKEN = "adm1n";
    eth.resetEthProvider();
    assert.equal(eth.getEthProvider().network, "local");
  });

  it("simulated returns static gwei fees and throws elsewhere", async () => {
    const fees = await eth.getEthProvider().getFees();
    assert.deepEqual(fees, { slow: 1, standard: 2, fast: 5, source: "fallback" });
    await assert.rejects(eth.getEthProvider().getTxStatus("0x" + "a".repeat(64)));
    await assert.rejects(
      eth.getEthProvider().fundAddress("0x" + "b".repeat(40), "1000000000000000000"),
    );
    await assert.rejects(eth.getEthProvider().mineBlocks(1));
  });

  it("sepolia throws when ETH_RPC_URL is missing", () => {
    process.env.ETH_MODE = "sepolia";
    assert.throws(() => eth.getEthProvider(), /ETH_RPC_URL/);
  });

  it("local throws when infra env is missing", () => {
    process.env.ETH_MODE = "local";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    assert.throws(() => eth.getEthProvider(), /INFRA_SHARED_SECRET/);
  });

  it("mineBlocks throws fast on an empty mine token, not later at 403", async () => {
    process.env.ETH_MODE = "local";
    process.env.INFRA_BASE_URL = "https://infra.example.com";
    process.env.INFRA_SHARED_SECRET = "dev-token";
    await assert.rejects(eth.getEthProvider().mineBlocks(1), /ADMIN_MINE_TOKEN/);
  });

  it("maps infra failures to the offline 503, app errors to 400", () => {
    assert.deepEqual(eth.ethFailure(new Error(eth.ETH_OFFLINE_MESSAGE), "x"), {
      message: eth.ETH_OFFLINE_MESSAGE,
      status: 503,
    });
    assert.deepEqual(eth.ethFailure(new Error("INFRA_BASE_URL missing"), "x").status, 503);
    assert.deepEqual(eth.ethFailure(new Error("ETH_RPC_URL missing"), "x").status, 503);
    assert.deepEqual(eth.ethFailure(new Error("tx not found"), "x"), {
      message: "tx not found",
      status: 400,
    });
  });
});

describe("local eth transport", () => {
  let realFetch;
  let calls;
  beforeEach(() => {
    eth.resetEthProvider();
    process.env.ETH_MODE = "local";
    process.env.INFRA_BASE_URL = "https://infra.example.com/";
    process.env.INFRA_SHARED_SECRET = "dev-token";
    process.env.ADMIN_MINE_TOKEN = "adm1n";
    realFetch = global.fetch;
    calls = [];
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ETH_MODE;
    delete process.env.INFRA_BASE_URL;
    delete process.env.INFRA_SHARED_SECRET;
    delete process.env.ADMIN_MINE_TOKEN;
    eth.resetEthProvider();
  });

  it("sends Bearer auth on every call", async () => {
    global.fetch = async (url, init) => {
      calls.push([url, init]);
      return jsonResponse(200, { slow: 1, standard: 2, fast: 3 });
    };
    const fees = await eth.getEthProvider().getFees();
    assert.equal(fees.source, "live");
    assert.equal(fees.fast, 3);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "https://infra.example.com/api/eth/fees");
    assert.equal(calls[0][1].headers.Authorization, "Bearer dev-token");
  });

  it("retries once on 5xx, then reports offline", async () => {
    let n = 0;
    global.fetch = async () =>
      ++n === 1 ? jsonResponse(500, {}) : jsonResponse(200, { slow: 1, standard: 2, fast: 3 });
    const fees = await eth.getEthProvider().getFees();
    assert.equal(fees.source, "live");
    assert.equal(n, 2);
    global.fetch = async () => jsonResponse(503, {});
    await assert.rejects(eth.getEthProvider().getFees(), new RegExp(eth.ETH_OFFLINE_MESSAGE));
  });

  it("sends the admin token when mining", async () => {
    global.fetch = async (url, init) => {
      calls.push([url, init]);
      return jsonResponse(200, { height: 42 });
    };
    const { height } = await eth.getEthProvider().mineBlocks(2);
    assert.equal(height, 42);
    assert.equal(calls[0][1].headers["X-Admin-Token"], "adm1n");
    assert.deepEqual(JSON.parse(calls[0][1].body), { blocks: 2 });
  });

  it("funds by address plus decimal wei string", async () => {
    global.fetch = async (url, init) => {
      calls.push([url, init]);
      return jsonResponse(200, { balanceWei: "1000000000000000000" });
    };
    const funded = await eth
      .getEthProvider()
      .fundAddress(`0x${"b".repeat(40)}`, "1000000000000000000");
    assert.equal(funded.balanceWei, "1000000000000000000");
    assert.deepEqual(JSON.parse(calls[0][1].body), {
      address: `0x${"b".repeat(40)}`,
      amountWei: "1000000000000000000",
    });
  });

  it("maps 404 to tx not found", async () => {
    global.fetch = async () => jsonResponse(404, { error: "tx not found" });
    await assert.rejects(eth.getEthProvider().getTxStatus(`0x${"a".repeat(64)}`), /tx not found/);
  });
});

describe("sepolia client", () => {
  let realFetch;
  beforeEach(() => {
    eth.resetEthProvider();
    process.env.ETH_MODE = "sepolia";
    process.env.ETH_RPC_URL = "https://rpc.sepolia.example";
    realFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ETH_MODE;
    delete process.env.ETH_RPC_URL;
    eth.resetEthProvider();
  });

  it("maps feeHistory percentiles to slow/standard/fast gwei", async () => {
    global.fetch = async () =>
      rpcResult({ reward: [["0x3b9aca00", "0x77359400", "0x12a05f200"]] });
    const fees = await eth.getEthProvider().getFees();
    assert.equal(fees.source, "live");
    assert.equal(fees.slow, 1);
    assert.equal(fees.standard, 2);
    assert.equal(fees.fast, 5);
  });

  it("falls back to gasPrice when feeHistory fails", async () => {
    global.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === "eth_feeHistory") throw new Error("boom");
      return rpcResult("0x77359400");
    };
    const fees = await eth.getEthProvider().getFees();
    assert.equal(fees.source, "fallback");
    assert.equal(fees.slow, 2);
    assert.equal(fees.standard, 2);
    assert.equal(fees.fast, 2);
  });

  it("reads receipt confirmations against the tip", async () => {
    global.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === "eth_getTransactionReceipt") {
        return rpcResult({ blockNumber: "0x64" });
      }
      return rpcResult("0x66");
    };
    const status = await eth.getEthProvider().getTxStatus(`0x${"a".repeat(64)}`);
    assert.deepEqual(status, { confirmed: true, confirmations: 3, blockNumber: 100 });
  });

  it("rejects malformed hashes without calling", async () => {
    let n = 0;
    global.fetch = async () => {
      n++;
      return rpcResult(null);
    };
    await assert.rejects(eth.getEthProvider().getTxStatus("nope"), /tx not found/);
    assert.equal(n, 0);
  });
});

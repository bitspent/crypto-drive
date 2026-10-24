// infra-api: the self-hosted side of docs/infra-contract.md. Talks to
// bitcoind (RPC), electrs/Esplora (HTTP) — provided by Nigiri in dev — and
// exposes the five app-facing routes. Auth: Bearer INFRA_SHARED_SECRET on
// every route; POST /api/mine additionally requires X-Admin-Token.
// Rate limiting and TLS live in Caddy in production (see the contract);
// this service does neither — never expose it directly.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { formatBitcoindError } from "./bitcoind-error.js";

const {
  BITCOIN_RPC_URL,
  BITCOIN_RPC_USER,
  BITCOIN_RPC_PASSWORD,
  ELECTRS_HTTP_URL,
  ESPLORA_URL,
  INFRA_SHARED_SECRET,
  ADMIN_MINE_TOKEN,
  PORT = "8081",
} = process.env;

if (!INFRA_SHARED_SECRET?.trim()) throw new Error("INFRA_SHARED_SECRET is required.");
if (!ADMIN_MINE_TOKEN?.trim()) throw new Error("ADMIN_MINE_TOKEN is required.");
if (!BITCOIN_RPC_URL || !BITCOIN_RPC_USER || !BITCOIN_RPC_PASSWORD) {
  throw new Error("BITCOIN_RPC_URL/USER/PASSWORD are required.");
}
if (!ELECTRS_HTTP_URL) throw new Error("ELECTRS_HTTP_URL is required.");

const WALLET = "infra-faucet";
const MAX_FUND_SATS = 1_000_000;
const SATS_PER_BTC = 100_000_000;

const app = new Hono();

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function log(event, detail = {}) {
  console.log(JSON.stringify({ event, service: "infra-api", ...detail }));
}

// Bearer gate on every route.
app.use(async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, INFRA_SHARED_SECRET)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

async function rpc(method, params = [], wallet = false) {
  const url = wallet ? `${BITCOIN_RPC_URL}/wallet/${WALLET}` : BITCOIN_RPC_URL;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Basic ${Buffer.from(`${BITCOIN_RPC_USER}:${BITCOIN_RPC_PASSWORD}`).toString("base64")}`,
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: "infra", method, params }),
    signal: AbortSignal.timeout(15000),
  });
  // Read the body BEFORE checking status: bitcoind puts the reason for a
  // 500 in body.error, and ensureWallet() matches on it. Throwing on the
  // status alone would swallow "already exists" / "already loaded" and 503
  // fund+mine forever after a bitcoind restart.
  const body = await res.json().catch(() => null);
  if (!res.ok || body == null || body.error) {
    throw new Error(formatBitcoindError(res.status, body));
  }
  return body.result;
}

// Load (creating on first run) the faucet wallet. Checked on EVERY call,
// never cached: bitcoind forgets loaded wallets on restart and anything
// can unload at runtime, so a cached "ready" goes stale and 503s fund+mine
// until the container restarts. listwallets is one cheap local RPC;
// concurrent create/load races are absorbed by the idempotency catches.
async function ensureWallet() {
  const wallets = await rpc("listwallets");
  if (wallets.includes(WALLET)) return;
  try {
    await rpc("createwallet", [WALLET]);
  } catch (e) {
    if (!String(e).includes("already exists")) throw e;
  }
  try {
    await rpc("loadwallet", [WALLET]);
  } catch (e) {
    if (!String(e).includes("already loaded")) throw e;
  }
}

async function electrs(path) {
  const res = await fetch(`${ELECTRS_HTTP_URL}${path}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`electrs http ${res.status}`);
  return res.json();
}

function toSats(btc) {
  return Math.round(Number(btc) * SATS_PER_BTC);
}

app.get("/api/health", async (c) => {
  let bitcoindReady = false;
  let electrsReady = false;
  let walletLoaded = false;
  let faucetBalance = 0;
  try {
    await rpc("getblockcount");
    bitcoindReady = true;
  } catch (e) {
    log("health.bitcoind_down", { error: String(e).slice(0, 120) });
  }
  try {
    await electrs("/blocks/tip/height");
    electrsReady = true;
  } catch (e) {
    log("health.electrs_down", { error: String(e).slice(0, 120) });
  }
  if (bitcoindReady) {
    try {
      await ensureWallet();
      walletLoaded = true;
      faucetBalance = toSats(await rpc("getbalance", [], true));
    } catch {
      walletLoaded = false;
      faucetBalance = 0;
    }
  }
  return c.json({
    ok: true,
    bitcoind_ready: bitcoindReady,
    electrs_ready: electrsReady,
    wallet_ready: walletLoaded,
    faucet_balance: faucetBalance,
  });
});

app.post("/api/address/fund", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const amountSats = body.amountSats;
  if (!address) return c.json({ error: "invalid address" }, 400);
  if (!Number.isInteger(amountSats) || amountSats <= 0 || amountSats > MAX_FUND_SATS) {
    return c.json({ error: "amount out of range" }, 400);
  }
  let info;
  try {
    info = await rpc("validateaddress", [address]);
  } catch {
    return c.json({ error: "faucet empty" }, 503);
  }
  if (!info?.isvalid) return c.json({ error: "invalid address" }, 400);
  try {
    await ensureWallet();
    let balance = toSats(await rpc("getbalance", [], true));
    if (balance < amountSats) {
      // Self-funding faucet: mature fresh coinbase, then re-check once.
      const matureAddr = await rpc("getnewaddress", ["faucet-topup"], true);
      await rpc("generatetoaddress", [101, matureAddr]);
      balance = toSats(await rpc("getbalance", [], true));
    }
    if (balance < amountSats) return c.json({ error: "faucet empty" }, 503);
    const txid = await rpc("sendtoaddress", [address, amountSats / SATS_PER_BTC], true);
    log("faucet.funded", { amountSats });
    return c.json({ txid });
  } catch (e) {
    log("faucet.error", { error: String(e).slice(0, 160) });
    return c.json({ error: "faucet empty" }, 503);
  }
});

app.get("/api/tx/:txid", async (c) => {
  const txid = c.req.param("txid") ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
    return c.json({ error: "tx not found" }, 404);
  }
  let status;
  try {
    status = await electrs(`/tx/${txid}/status`);
  } catch {
    return c.json({ error: "tx not found" }, 404);
  }
  if (!status) return c.json({ error: "tx not found" }, 404);
  if (!status.confirmed) {
    return c.json({ confirmed: false, confirmations: 0, blockHeight: null });
  }
  const tip = Number(await electrs("/blocks/tip/height").catch(() => status.block_height));
  return c.json({
    confirmed: true,
    confirmations: Math.max(1, tip - status.block_height + 1),
    blockHeight: status.block_height,
  });
});

app.post("/api/mine", async (c) => {
  const token = c.req.header("x-admin-token") ?? "";
  if (!token || !safeEqual(token, ADMIN_MINE_TOKEN)) {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const blocks = body.blocks === undefined ? 1 : body.blocks;
  if (!Number.isInteger(blocks) || blocks < 1 || blocks > 10) {
    return c.json({ error: "blocks out of range" }, 400);
  }
  try {
    await ensureWallet();
    // Mining pays the faucet wallet: every mine call also funds the faucet.
    const addr = await rpc("getnewaddress", ["mining"], true);
    await rpc("generatetoaddress", [blocks, addr]);
    const height = await rpc("getblockcount");
    return c.json({ height });
  } catch (e) {
    log("mine.error", { error: String(e).slice(0, 160) });
    return c.json({ error: "mine failed" }, 503);
  }
});

app.get("/api/fees", async (c) => {
  // Regtest has no fee market: nominal 1 sat/vB everywhere. Esplora's
  // estimates are consulted first so a busy dev chain still reports sanely.
  const nominal = { fastest: 1, halfHour: 1, hour: 1, economy: 1, minimum: 1 };
  if (!ESPLORA_URL) return c.json(nominal);
  try {
    const res = await fetch(`${ESPLORA_URL}/fee-estimates`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return c.json(nominal);
    const est = await res.json();
    const at = (...targets) => {
      for (const t of targets) {
        const v = Math.ceil(Number(est[String(t)]));
        if (Number.isFinite(v) && v > 0) return v;
      }
      return 1;
    };
    return c.json({
      fastest: at(1, 2),
      halfHour: at(3, 2, 1),
      hour: at(6, 3, 1),
      economy: at(144, 6, 1),
      minimum: 1,
    });
  } catch {
    return c.json(nominal);
  }
});

// ─── ETH (Anvil local devnet) ─────────────────────────────────────────────
// Optional sidecar: when ANVIL_RPC_URL is unset the eth routes 503 and the
// Bitcoin routes are unaffected (BTC-only deploys never set it).
const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL?.trim() || "";
const MAX_FUND_WEI = 10n ** 19n; // 10 ETH

function requireAnvil(c) {
  if (!ANVIL_RPC_URL) return c.json({ error: "eth devnet not configured" }, 503);
  return null;
}

async function eth(method, params = []) {
  const res = await fetch(ANVIL_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "infra", method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body == null || body.error) {
    const reason = body?.error?.message ? `eth: ${body.error.message}` : `eth ${res.status}`;
    throw new Error(reason);
  }
  return body.result;
}

const hexToBig = (h) => BigInt(h);
const gweiOf = (wei) => Number(wei) / 1e9;

app.get("/api/eth/status", async (c) => {
  const missing = requireAnvil(c);
  if (missing) return missing;
  try {
    const [chainId, block, gasPrice] = await Promise.all([
      eth("eth_chainId"),
      eth("eth_blockNumber"),
      eth("eth_gasPrice"),
    ]);
    return c.json({
      ok: true,
      chainId: Number(hexToBig(chainId)),
      blockNumber: Number(hexToBig(block)),
      gasPriceGwei: gweiOf(hexToBig(gasPrice)),
    });
  } catch (e) {
    log("eth.status.error", { error: String(e).slice(0, 160) });
    return c.json({ error: "eth devnet unreachable" }, 503);
  }
});

app.post("/api/eth/address/fund", async (c) => {
  const missing = requireAnvil(c);
  if (missing) return missing;
  const body = await c.req.json().catch(() => ({}));
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const amountWei = typeof body.amountWei === "string" ? body.amountWei.trim() : "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return c.json({ error: "invalid address" }, 400);
  }
  let amount;
  try {
    amount = BigInt(amountWei);
  } catch {
    return c.json({ error: "amount out of range" }, 400);
  }
  if (amount <= 0n || amount > MAX_FUND_WEI) {
    return c.json({ error: "amount out of range" }, 400);
  }
  try {
    // Anvil-native faucet: no signing needed, and no txid exists.
    await eth("anvil_setBalance", [address, `0x${amount.toString(16)}`]);
    const balance = await eth("eth_getBalance", [address, "latest"]);
    log("eth.faucet.funded", { amountWei: amount.toString() });
    return c.json({ balanceWei: hexToBig(balance).toString() });
  } catch (e) {
    log("eth.faucet.error", { error: String(e).slice(0, 160) });
    return c.json({ error: "faucet failed" }, 503);
  }
});

app.get("/api/eth/tx/:hash", async (c) => {
  const missing = requireAnvil(c);
  if (missing) return missing;
  const hash = c.req.param("hash") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return c.json({ error: "tx not found" }, 404);
  }
  try {
    const receipt = await eth("eth_getTransactionReceipt", [hash]);
    if (!receipt) {
      return c.json({ error: "tx not found" }, 404);
    }
    if (!receipt.blockNumber) {
      return c.json({ confirmed: false, confirmations: 0, blockNumber: null });
    }
    const tip = Number(hexToBig(await eth("eth_blockNumber")));
    const at = Number(hexToBig(receipt.blockNumber));
    return c.json({
      confirmed: true,
      confirmations: Math.max(1, tip - at + 1),
      blockNumber: at,
    });
  } catch {
    return c.json({ error: "tx not found" }, 404);
  }
});

app.post("/api/eth/mine", async (c) => {
  const missing = requireAnvil(c);
  if (missing) return missing;
  const token = c.req.header("x-admin-token") ?? "";
  if (!token || !safeEqual(token, ADMIN_MINE_TOKEN)) {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const blocks = body.blocks === undefined ? 1 : body.blocks;
  if (!Number.isInteger(blocks) || blocks < 1 || blocks > 10) {
    return c.json({ error: "blocks out of range" }, 400);
  }
  try {
    await eth("anvil_mine", [`0x${blocks.toString(16)}`]);
    const height = Number(hexToBig(await eth("eth_blockNumber")));
    return c.json({ height });
  } catch (e) {
    log("eth.mine.error", { error: String(e).slice(0, 160) });
    return c.json({ error: "mine failed" }, 503);
  }
});

app.get("/api/eth/fees", async (c) => {
  const missing = requireAnvil(c);
  if (missing) return missing;
  try {
    // feeHistory percentiles map to slow/standard/fast; gasPrice backstops.
    const [history, gasPrice] = await Promise.all([
      eth("eth_feeHistory", ["0x4", "latest", [25, 50, 75]]).catch(() => null),
      eth("eth_gasPrice"),
    ]);
    const base = gweiOf(hexToBig(gasPrice));
    if (!history?.reward?.length) {
      return c.json({ slow: base, standard: base, fast: base });
    }
    const last = history.reward[history.reward.length - 1].map((h) => gweiOf(hexToBig(h)));
    return c.json({ slow: last[0], standard: last[1], fast: last[2] });
  } catch (e) {
    log("eth.fees.error", { error: String(e).slice(0, 120) });
    return c.json({ error: "fees unavailable" }, 503);
  }
});

app.notFound((c) => c.json({ error: "not found" }, 404));

const port = Number(PORT);
log("infra-api.boot", { port });
serve({ fetch: app.fetch, port });

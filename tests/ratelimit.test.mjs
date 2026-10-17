// Rate limiting: generic allow-then-block shape, presets, key isolation,
// window reset, IP parsing, exemptions, and the 429 contract.
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/ratelimit.test.mjs"));
const rl = jiti(join(root, "src/lib/ratelimit.ts"));
const ips = jiti(join(root, "src/lib/request-ip.ts"));

const savedEnv = { ...process.env };
let id = 0;
const fresh = (prefix) => `${prefix}-${Date.now()}-${id++}`;

beforeEach(() => {
  rl.resetRateLimits();
  delete process.env.ADMIN_MINE_TOKEN;
  delete process.env.NODE_ENV;
});
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("ratelimit", () => {
  it("presets match the specified caps and windows", () => {
    assert.deepEqual(rl.RATE_LIMITS.unlock, { limit: 10, windowMs: 5 * 60 * 1000 });
    assert.deepEqual(rl.RATE_LIMITS.progress, { limit: 60, windowMs: 5 * 60 * 1000 });
    assert.deepEqual(rl.RATE_LIMITS.complete, { limit: 3, windowMs: 60 * 60 * 1000 });
    assert.deepEqual(rl.RATE_LIMITS.webhook, { limit: 100, windowMs: 60 * 1000 });
    assert.deepEqual(rl.RATE_LIMITS.wallet, { limit: 60, windowMs: 60 * 1000 });
    assert.deepEqual(rl.RATE_LIMITS.faucet, { limit: 3, windowMs: 5 * 60 * 1000 });
  });

  it("allows N requests with decreasing remaining, blocks N+1", () => {
    const key = fresh("cap");
    const cfg = { key, limit: 3, windowMs: 60_000 };
    assert.deepEqual(rl.checkRateLimit(cfg), { allowed: true, remaining: 2, retryAfter: 0 });
    assert.deepEqual(rl.checkRateLimit(cfg), { allowed: true, remaining: 1, retryAfter: 0 });
    assert.deepEqual(rl.checkRateLimit(cfg), { allowed: true, remaining: 0, retryAfter: 0 });
    const blocked = rl.checkRateLimit(cfg);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
  });

  it("retryAfter counts down toward the window end", async () => {
    const cfg = { key: fresh("retry"), limit: 1, windowMs: 1200 };
    assert.equal(rl.checkRateLimit(cfg).allowed, true);
    const first = rl.checkRateLimit(cfg).retryAfter;
    await new Promise((r) => setTimeout(r, 1100));
    const second = rl.checkRateLimit(cfg).retryAfter;
    assert.ok(first >= second);
    assert.ok(second >= 1);
  });

  it("resets when the window elapses", async () => {
    const cfg = { key: fresh("window"), limit: 1, windowMs: 40 };
    assert.equal(rl.checkRateLimit(cfg).allowed, true);
    assert.equal(rl.checkRateLimit(cfg).allowed, false);
    await new Promise((r) => setTimeout(r, 60));
    const again = rl.checkRateLimit(cfg);
    assert.deepEqual(again, { allowed: true, remaining: 0, retryAfter: 0 });
  });

  it("isolates keys from each other", () => {
    const cfg = (key) => ({ key, limit: 1, windowMs: 60_000 });
    assert.equal(rl.checkRateLimit(cfg("a")).allowed, true);
    assert.equal(rl.checkRateLimit(cfg("a")).allowed, false);
    assert.equal(rl.checkRateLimit(cfg("b")).allowed, true);
  });

  it("parses the client IP from X-Forwarded-For, else unknown", () => {
    assert.equal(ips.ipFromHeaders("1.2.3.4, 5.6.7.8"), "1.2.3.4");
    assert.equal(ips.ipFromHeaders("  9.9.9.9  "), "9.9.9.9");
    assert.equal(ips.ipFromHeaders(null), "unknown");
    assert.equal(ips.ipFromHeaders(""), "unknown");
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "7.7.7.7, 8.8.8.8" },
    });
    assert.equal(ips.getClientIp(req), "7.7.7.7");
    assert.equal(ips.getClientIp(new Request("http://x/")), "unknown");
  });

  it("recognizes loopback addresses", () => {
    assert.equal(ips.isLoopbackIp("127.0.0.1"), true);
    assert.equal(ips.isLoopbackIp("::1"), true);
    assert.equal(ips.isLoopbackIp("::ffff:127.0.0.1"), true);
    assert.equal(ips.isLoopbackIp("1.2.3.4"), false);
    assert.equal(ips.isLoopbackIp("unknown"), false);
  });

  it("bypasses only with a valid admin token", () => {
    assert.equal(rl.isAdminToken("anything"), false);
    process.env.ADMIN_MINE_TOKEN = "adm";
    assert.equal(rl.isAdminToken("adm"), true);
    assert.equal(rl.isAdminToken(" adm "), true);
    assert.equal(rl.isAdminToken("wrong"), false);
    const authed = new Request("http://x/", { headers: { "x-admin-token": "adm" } });
    assert.equal(rl.isAdminRequest(authed), true);
    assert.equal(rl.isAdminRequest(new Request("http://x/")), false);
  });

  it("bypasses localhost only in dev", () => {
    const loopback = new Request("http://x/", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const remote = new Request("http://x/", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    process.env.NODE_ENV = "development";
    assert.equal(rl.isLocalDevRequest(loopback), true);
    assert.equal(rl.isLocalDevRequest(remote), false);
    process.env.NODE_ENV = "production";
    assert.equal(rl.isLocalDevRequest(loopback), false);
  });

  it("returns the 429 contract: status, body, Retry-After", async () => {
    const res = rl.rateLimitedResponse(42);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "42");
    assert.deepEqual(await res.json(), {
      error: "Too many requests. Try again in 42 seconds.",
    });
  });
});

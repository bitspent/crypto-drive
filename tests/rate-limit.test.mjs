// Rate limiting: presets match the prompt, windows allow-then-block, identity
// isolation, IP parsing, admin bypass, and the 429 contract.
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/rate-limit.test.mjs"));
const rl = jiti(join(root, "src/lib/rate-limit.ts"));

const savedEnv = { ...process.env };
let id = 0;
const fresh = (prefix) => `${prefix}-${Date.now()}-${id++}`;

beforeEach(() => {
  rl.resetRateLimits();
  delete process.env.ADMIN_MINE_TOKEN;
});
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("rate limits", () => {
  it("presets match the specified caps and windows", () => {
    assert.deepEqual(rl.RATE_LIMITS.unlock, { windowMs: 5 * 60 * 1000, max: 10 });
    assert.deepEqual(rl.RATE_LIMITS.progress, { windowMs: 5 * 60 * 1000, max: 60 });
    assert.deepEqual(rl.RATE_LIMITS.complete, { windowMs: 60 * 60 * 1000, max: 3 });
    assert.deepEqual(rl.RATE_LIMITS.webhook, { windowMs: 60 * 1000, max: 100 });
  });

  it("allows max hits then blocks with a retryAfter inside the window", () => {
    const who = fresh("cap");
    for (let i = 0; i < 60; i++) {
      assert.deepEqual(rl.checkRateLimit("progress", who), { ok: true });
    }
    const verdict = rl.checkRateLimit("progress", who);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.retryAfter >= 1 && verdict.retryAfter <= 300);
  });

  it("resets when the window elapses", async () => {
    const who = fresh("window");
    const tiny = { windowMs: 40, max: 1 };
    assert.deepEqual(rl.checkRateLimit("unlock", who, tiny), { ok: true });
    assert.equal(rl.checkRateLimit("unlock", who, tiny).ok, false);
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(rl.checkRateLimit("unlock", who, tiny), { ok: true });
  });

  it("isolates identities and buckets from each other", () => {
    const tiny = { windowMs: 60_000, max: 1 };
    assert.deepEqual(rl.checkRateLimit("complete", "a", tiny), { ok: true });
    assert.equal(rl.checkRateLimit("complete", "a", tiny).ok, false);
    assert.deepEqual(rl.checkRateLimit("complete", "b", tiny), { ok: true });
    assert.deepEqual(rl.checkRateLimit("unlock", "a", tiny), { ok: true });
  });

  it("resetRateLimits clears every bucket", () => {
    const tiny = { windowMs: 60_000, max: 1 };
    assert.equal(rl.checkRateLimit("webhook", fresh("r"), tiny).ok, true);
    rl.resetRateLimits();
    assert.deepEqual(rl.checkRateLimit("webhook", fresh("r2"), tiny), { ok: true });
  });

  it("parses the client IP from X-Forwarded-For, X-Real-IP, or unknown", () => {
    assert.equal(rl.ipFromHeaders("1.2.3.4, 5.6.7.8", null), "1.2.3.4");
    assert.equal(rl.ipFromHeaders("  9.9.9.9  ", null), "9.9.9.9");
    assert.equal(rl.ipFromHeaders(null, "2.3.4.5"), "2.3.4.5");
    assert.equal(rl.ipFromHeaders(null, null), "unknown");
    assert.equal(rl.ipFromHeaders("", ""), "unknown");
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "7.7.7.7, 8.8.8.8" },
    });
    assert.equal(rl.clientIp(req), "7.7.7.7");
  });

  it("bypasses only with a valid admin token", () => {
    assert.equal(rl.isAdminToken("anything"), false);
    process.env.ADMIN_MINE_TOKEN = "adm";
    assert.equal(rl.isAdminToken("adm"), true);
    assert.equal(rl.isAdminToken(" adm "), true);
    assert.equal(rl.isAdminToken("wrong"), false);
    assert.equal(rl.isAdminToken(null), false);
    const authed = new Request("http://x/", { headers: { "x-admin-token": "adm" } });
    const plain = new Request("http://x/");
    assert.equal(rl.isAdminBypass(authed), true);
    assert.equal(rl.isAdminBypass(plain), false);
  });

  it("returns the 429 contract: status, body, Retry-After", async () => {
    const res = rl.rateLimitedResponse(42);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "42");
    assert.deepEqual(await res.json(), { error: "rate limited", retryAfter: 42 });
  });
});

// Gumroad commerce: key format, webhook auth/parse/idempotency, license
// unlock paths. DB-backed cases need DATABASE_URL (else skipped); run the
// DB pass serially: DATABASE_URL=... node --test --test-concurrency=1 tests/
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setupTestDb } from "../scripts/db-test-setup.mjs";

const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/gumroad.test.mjs"));
const license = jiti(join(root, "src/lib/license.ts"));
const webhook = jiti(join(root, "src/lib/gumroad-webhook.ts"));
const gumroad = jiti(join(root, "src/lib/gumroad.ts"));
const store = jiti(join(root, "src/lib/store.ts"));
const client = jiti(join(root, "src/lib/db/client.ts"));

const ENV_KEYS = [
  "NODE_ENV",
  "ALLOW_DEMO_LICENSES",
  "GUMROAD_WEBHOOK_SECRET",
  "GUMROAD_PRODUCT_STARTER",
  "GUMROAD_PRODUCT_CERTIFIED",
  "GUMROAD_PRODUCT_VIP",
  "GUMROAD_ACCESS_TOKEN",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];
const savedEnv = {};
function stashEnv() {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
}
function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

describe("license keys", () => {
  it("generates well-formed keys per tier", () => {
    for (const tier of ["starter", "certified", "vip"]) {
      const key = license.generateLicenseKey(tier);
      assert.match(key, new RegExp(`^CD-${tier.toUpperCase()}-[A-HJ-NP-Z2-9]{8}$`));
      assert.equal(license.validateLicenseFormat(key), true);
      assert.equal(license.tierFromLicenseKey(key), tier);
    }
    assert.notEqual(license.generateLicenseKey("vip"), license.generateLicenseKey("vip"));
  });

  it("rejects malformed keys", () => {
    assert.equal(license.validateLicenseFormat("CD-DRIVE-2026"), false);
    assert.equal(license.validateLicenseFormat("CD-CERTIFIED-SHORT"), false);
    assert.equal(license.validateLicenseFormat("CD-CERTIFIED-ABCDEFGH0"), false);
    assert.equal(license.validateLicenseFormat("CD-GOLD-ABCDEFGH"), false);
    assert.equal(license.validateLicenseFormat(""), false);
    assert.equal(license.tierFromLicenseKey("nope"), null);
  });

  it("classifies demo, licensed, blocked, and unknown keys", () => {
    assert.equal(license.resolveLicenseKind("CD-CERTIFIED-K3M9P2XQ", {}), "licensed");
    assert.equal(license.resolveLicenseKind("garbage", {}), "unknown");
    assert.equal(license.resolveLicenseKind("CD-DRIVE-2026", {}), "demo");
    assert.equal(
      license.resolveLicenseKind("CD-DRIVE-2026", { NODE_ENV: "production" }),
      "demo-blocked",
    );
    assert.equal(
      license.resolveLicenseKind("CD-DRIVE-2026", {
        NODE_ENV: "production",
        ALLOW_DEMO_LICENSES: "1",
      }),
      "demo",
    );
  });
});

describe("webhook auth + parsing (no DB)", () => {
  beforeEach(stashEnv);
  afterEach(restoreEnv);

  it("accepts the query secret or the header, rejects the rest", () => {
    process.env.GUMROAD_WEBHOOK_SECRET = "s3cret";
    assert.equal(
      webhook.verifyWebhookSecret({ querySecret: "s3cret", headerSignature: null }),
      true,
    );
    assert.equal(
      webhook.verifyWebhookSecret({ querySecret: null, headerSignature: "s3cret" }),
      true,
    );
    assert.equal(
      webhook.verifyWebhookSecret({ querySecret: "wrong", headerSignature: null }),
      false,
    );
    assert.equal(
      webhook.verifyWebhookSecret({ querySecret: null, headerSignature: null }),
      false,
    );
    delete process.env.GUMROAD_WEBHOOK_SECRET;
    assert.equal(
      webhook.verifyWebhookSecret({ querySecret: "s3cret", headerSignature: null }),
      false,
    );
  });

  it("parses form-encoded sale pings, ignores the rest", () => {
    const sale = new URLSearchParams({
      resource_name: "sale",
      sale_id: "sale_1",
      email: "Buyer@Example.com",
      product_id: "prod_cert",
      price: "4900",
      currency: "USD",
    });
    assert.deepEqual(webhook.parsePingForm(sale), {
      saleId: "sale_1",
      email: "buyer@example.com",
      productRef: "prod_cert",
      price: "4900",
      currency: "USD",
    });
    assert.equal(
      webhook.parsePingForm(new URLSearchParams({ resource_name: "refund", sale_id: "x" })),
      null,
    );
    assert.equal(webhook.parsePingForm(new URLSearchParams({ sale_id: "x" })), null);
  });

  it("maps product refs to tiers, unknown refs to null", () => {
    process.env.GUMROAD_PRODUCT_STARTER = "prod_starter";
    process.env.GUMROAD_PRODUCT_CERTIFIED = "prod_cert";
    process.env.GUMROAD_PRODUCT_VIP = "prod_vip";
    assert.equal(webhook.tierForProductRef("prod_starter"), "starter");
    assert.equal(webhook.tierForProductRef("prod_cert"), "certified");
    assert.equal(webhook.tierForProductRef("prod_vip"), "vip");
    assert.equal(webhook.tierForProductRef("prod_nope"), null);
    assert.equal(webhook.tierForProductRef(""), null);
  });
});

describe("gumroad license API client (stubbed fetch)", () => {
  let realFetch;
  beforeEach(() => {
    stashEnv();
    realFetch = global.fetch;
    process.env.GUMROAD_ACCESS_TOKEN = "tok";
  });
  afterEach(() => {
    global.fetch = realFetch;
    restoreEnv();
  });

  it("returns the buyer email on success, rejects the rest", async () => {
    global.fetch = async (url, init) => {
      assert.equal(url, "https://api.gumroad.com/v2/licenses/verify");
      assert.equal(init.headers.Authorization, "Bearer tok");
      assert.ok(init.body.includes("license_key="));
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, purchase: { email: "Paid@Example.com" } }),
      };
    };
    assert.deepEqual(await gumroad.verifyGumroadLicense("prod_cert", "CD-X"), {
      ok: true,
      email: "paid@example.com",
    });

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: false }),
    });
    assert.deepEqual(await gumroad.verifyGumroadLicense("prod_cert", "CD-X"), { ok: false });

    global.fetch = async () => {
      throw new Error("down");
    };
    assert.deepEqual(await gumroad.verifyGumroadLicense("prod_cert", "CD-X"), { ok: false });
  });

  it("still calls the API without a token, minus the header", async () => {
    delete process.env.GUMROAD_ACCESS_TOKEN;
    let seen;
    global.fetch = async (url, init) => {
      seen = init.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, purchase: { email: "e@x.co" } }),
      };
    };
    assert.deepEqual(await gumroad.verifyGumroadLicense("prod_cert", "CD-X"), {
      ok: true,
      email: "e@x.co",
    });
    assert.equal(seen.Authorization, undefined);
  });
});

describe("webhook processing (needs DB)", { skip: !HAS_DB }, () => {
  let realFetch;
  let resendCalls;
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await client.closeDb();
  });
  beforeEach(() => {
    stashEnv();
    realFetch = global.fetch;
    resendCalls = [];
    process.env.GUMROAD_PRODUCT_STARTER = "prod_starter";
    process.env.GUMROAD_PRODUCT_CERTIFIED = "prod_cert";
    process.env.GUMROAD_PRODUCT_VIP = "prod_vip";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Crypto Drive <hello@example.com>";
    global.fetch = async (url, init) => {
      if (String(url).includes("api.resend.com")) {
        resendCalls.push(JSON.parse(init.body));
        return { ok: true, status: 200, json: async () => ({ id: "re_123" }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };
  });
  afterEach(() => {
    global.fetch = realFetch;
    restoreEnv();
  });

  it("provisions once per sale_id and emails once", async () => {
    const sale = {
      saleId: `sale_${Date.now()}`,
      email: `buyer-${Date.now()}@example.com`,
      productRef: "prod_cert",
    };
    const first = await webhook.processGumroadSale(sale);
    assert.equal(first.handled, true);
    assert.equal(first.duplicate, false);
    assert.equal(first.tier, "certified");
    assert.ok(first.licenseKey);
    const student = await store.findStudentByLicenseKey(first.licenseKey);
    assert.equal(student?.email, sale.email);
    assert.equal(student?.tier, "certified");
    assert.equal(resendCalls.length, 1);
    assert.ok(resendCalls[0].html.includes(first.licenseKey));

    const second = await webhook.processGumroadSale(sale);
    assert.equal(second.duplicate, true);
    assert.equal(resendCalls.length, 1);
    const stillOne = await store.findStudentByLicenseKey(first.licenseKey);
    assert.equal(stillOne?.id, student?.id);
  });

  it("unknown products ack without provisioning", async () => {
    const outcome = await webhook.processGumroadSale({
      saleId: `sale_unknown_${Date.now()}`,
      email: `nobody-${Date.now()}@example.com`,
      productRef: "prod_nope",
    });
    assert.deepEqual(outcome, { handled: false, reason: "unknown-product" });
    assert.equal(resendCalls.length, 0);
  });

  it("upgrades a demo student, keeping seed and progress", async () => {
    const addr = `upgrade-${Date.now()}@example.com`;
    const demo = await store.unlockStudent(addr, "CD-DRIVE-2026");
    await store.passStep(demo.sessionId, "btc-intro-satoshi");
    const before = await store.getStudentBySession(demo.sessionId);

    const outcome = await webhook.processGumroadSale({
      saleId: `sale_up_${Date.now()}`,
      email: addr,
      productRef: "prod_vip",
    });
    assert.equal(outcome.handled, true);
    const after = await store.getStudentBySession(demo.sessionId);
    assert.equal(after?.id, before?.id);
    assert.equal(after?.tier, "vip");
    assert.ok(after?.licenseKey?.startsWith("CD-VIP-"));
    assert.equal(after?.practiceSeed, before?.practiceSeed);
    assert.ok(after?.modulesPassed["btc-intro-satoshi"]);
  });

  it("licensed unlock resolves from the DB without Gumroad", async () => {
    const addr = `licensed-${Date.now()}@example.com`;
    const outcome = await webhook.processGumroadSale({
      saleId: `sale_lic_${Date.now()}`,
      email: addr,
      productRef: "prod_starter",
    });
    assert.equal(outcome.handled, true);
    const found = await store.findStudentByLicenseKey(outcome.licenseKey);
    assert.equal(found?.email, addr);
    const sessionId = await store.createSessionForStudent(found.id);
    assert.equal((await store.getStudentBySession(sessionId))?.tier, "starter");
  });
});

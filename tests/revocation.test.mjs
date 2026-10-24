// Revocation: refund/dispute/cancellation pings revoke students; revoked
// students unlock nothing and lose live sessions with a 403. Runs against
// the file store, or Postgres when DATABASE_URL is set (serial pg pass).
import { describe, it, before, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setupTestDb } from "../scripts/db-test-setup.mjs";

const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/revocation.test.mjs"));
const store = jiti(join(root, "src/lib/store.ts"));
const webhook = jiti(join(root, "src/lib/gumroad-webhook.ts"));
const client = jiti(join(root, "src/lib/db/client.ts"));

const ENV_KEYS = ["GUMROAD_PRODUCT_STARTER", "GUMROAD_PRODUCT_CERTIFIED", "GUMROAD_PRODUCT_VIP", "RESEND_API_KEY"];
const savedEnv = {};
let n = 0;
const fresh = (p) => `${p}-${Date.now()}-${n++}`;

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.GUMROAD_PRODUCT_STARTER = "prod_starter";
  process.env.GUMROAD_PRODUCT_CERTIFIED = "prod_cert";
  process.env.GUMROAD_PRODUCT_VIP = "prod_vip";
  delete process.env.RESEND_API_KEY; // email step logs and continues
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
after(async () => {
  await client.closeDb();
});

function ping(params) {
  return new URLSearchParams(params);
}

async function provisionedSale(tag, tier = "certified") {
  const saleId = fresh(`${tag}-sale`);
  const email = `${fresh(`${tag}-buyer`)}@example.com`;
  const productRef = tier === "certified" ? "prod_cert" : `prod_${tier}`;
  const outcome = await webhook.processGumroadSale({
    saleId,
    email,
    productRef,
    price: "2000",
    currency: "USD",
  });
  assert.equal(outcome.handled, true);
  assert.equal(outcome.duplicate, false);
  return { saleId, email, licenseKey: outcome.licenseKey };
}

function battery(tag) {
  it("parses refund, dispute, cancellation, and subscription pings", () => {
    const cases = [
      [{ resource_name: "refund" }, "refund"],
      [{ resource_name: "dispute" }, "dispute"],
      [{ action: "cancellation" }, "cancellation"],
      [{ resource_name: "subscription_cancelled" }, "subscription_cancelled"],
      [{ resource_name: "sale", refunded: "true" }, "refund"],
      [{ event: "chargeback" }, "dispute"],
    ];
    for (const [params, event] of cases) {
      const parsed = webhook.parsePingRefund(ping({ sale_id: "s1", ...params }));
      assert.deepEqual(parsed, { saleId: "s1", event });
    }
    assert.equal(webhook.parsePingRefund(ping({ resource_name: "sale", sale_id: "s1" })), null);
    assert.equal(webhook.parsePingRefund(ping({ resource_name: "refund" })), null);
    const withEmail = webhook.parsePingRefund(
      ping({ resource_name: "refund", sale_id: "s9", email: "A@Example.com" }),
    );
    assert.equal(withEmail.email, "a@example.com");
    const fallback = webhook.parsePingRefund(
      ping({ resource_name: "refund", original_sale_id: "orig-1" }),
    );
    assert.equal(fallback.saleId, "orig-1");
  });

  it("a refund revokes the provisioned student", async () => {
    const { saleId, email } = await provisionedSale(`${tag}-refund`);
    const result = await webhook.processGumroadRefund({ saleId, event: "refund" });
    assert.deepEqual(result, { handled: true, revoked: true, duplicate: false });
    const student = await store.findStudentByEmail(email);
    assert.ok(student.revokedAt);
    assert.equal(student.revocationReason, "refund");
  });

  it("disputes and cancellations revoke with their own reasons", async () => {
    for (const event of ["dispute", "cancellation", "subscription_cancelled"]) {
      const { saleId, email } = await provisionedSale(`${tag}-${event}`);
      const result = await webhook.processGumroadRefund({ saleId, event });
      assert.equal(result.revoked, true);
      const student = await store.findStudentByEmail(email);
      assert.equal(student.revocationReason, event);
    }
  });

  it("duplicate refunds are idempotent", async () => {
    const { saleId, email } = await provisionedSale(`${tag}-dup`);
    await webhook.processGumroadRefund({ saleId, event: "refund" });
    const first = (await store.findStudentByEmail(email)).revokedAt;
    const again = await webhook.processGumroadRefund({ saleId, event: "refund" });
    assert.deepEqual(again, { handled: true, revoked: false, duplicate: true });
    assert.equal((await store.findStudentByEmail(email)).revokedAt, first);
  });

  it("refunds for unknown sales ack without revoking", async () => {
    const result = await webhook.processGumroadRefund({
      saleId: fresh(`${tag}-ghost`),
      event: "refund",
    });
    assert.deepEqual(result, { handled: true, revoked: false, duplicate: false });
  });

  it("a refund carrying its own email revokes without the sale event", async () => {
    const email = `${fresh(`${tag}-direct`)}@example.com`;
    await store.provisionLicensedStudent(email, "starter", "CD-STARTER-DIRECT1");
    const result = await webhook.processGumroadRefund({
      saleId: fresh(`${tag}-nosale`),
      event: "dispute",
      email,
    });
    assert.equal(result.revoked, true);
    assert.equal((await store.findStudentByEmail(email)).revocationReason, "dispute");
  });

  it("revoked students cannot unlock", async () => {
    const { email } = await provisionedSale(`${tag}-nounlock`);
    await store.revokeStudentByEmail(email, "refund");
    await assert.rejects(store.unlockStudent(email, "CD-DRIVE-2026"), {
      message: store.REVOKED_ERROR,
    });
  });

  it("live sessions die on first use after revocation, then read anonymous", async () => {
    const email = `${fresh(`${tag}-sess`)}@example.com`;
    const { sessionId } = await store.unlockStudent(email, "CD-DRIVE-2026");
    const active = await store.getSessionAccess(sessionId);
    assert.equal(active.status, "active");
    assert.equal(active.student.email, email);
    await store.revokeStudentByEmail(email, "dispute");
    assert.deepEqual(await store.getSessionAccess(sessionId), { status: "revoked" });
    assert.deepEqual(await store.getSessionAccess(sessionId), { status: "none" });
    assert.deepEqual(await store.getSessionAccess(undefined), { status: "none" });
    assert.deepEqual(await store.getSessionAccess("ses_nope"), { status: "none" });
  });

  it("a refund for a superseded tier does not revoke the current one", async () => {
    const email = `${fresh(`${tag}-upbuyer`)}@example.com`;
    const starterSaleId = fresh(`${tag}-up-starter`);
    const certSaleId = fresh(`${tag}-up-cert`);
    const starter = await webhook.processGumroadSale({
      saleId: starterSaleId,
      email,
      productRef: "prod_starter",
    });
    assert.equal(starter.duplicate, false);
    const certified = await webhook.processGumroadSale({
      saleId: certSaleId,
      email,
      productRef: "prod_cert",
    });
    assert.equal(certified.duplicate, false);
    assert.equal((await store.findStudentByEmail(email)).tier, "certified");
    // Refunding the old Starter purchase must not kill Certified access.
    const stale = await webhook.processGumroadRefund({ saleId: starterSaleId, event: "refund" });
    assert.deepEqual(stale, { handled: true, revoked: false, duplicate: false });
    const kept = await store.findStudentByEmail(email);
    assert.equal(kept.revokedAt ?? null, null);
    assert.equal(kept.tier, "certified");
    // Refunding the current tier still revokes.
    const current = await webhook.processGumroadRefund({ saleId: certSaleId, event: "refund" });
    assert.equal(current.revoked, true);
    assert.ok((await store.findStudentByEmail(email)).revokedAt);
  });

  it("a reshaped duplicate sale acks loudly and never overwrites", async () => {
    const { saleId, email } = await provisionedSale(`${tag}-reshape`);
    const intruder = `other-${Date.now()}-${n++}@example.com`;
    const lines = [];
    const origLog = console.log;
    console.log = (msg) => lines.push(String(msg));
    try {
      const again = await webhook.processGumroadSale({
        saleId,
        email: intruder,
        productRef: "prod_cert",
        price: "9999",
        currency: "USD",
      });
      assert.deepEqual(again, { handled: true, duplicate: true });
    } finally {
      console.log = origLog;
    }
    const mismatch = lines.find((l) => l.includes("webhook.duplicate_mismatch"));
    assert.ok(mismatch, "expected a duplicate_mismatch log line");
    assert.ok(mismatch.includes(saleId));
    // No overwrite: the original student stands, the new email has nobody.
    assert.equal((await store.findStudentByEmail(email)).email, email);
    assert.equal(await store.findStudentByEmail(intruder), null);
  });

  it("a new sale clears an earlier revocation", async () => {
    const { email } = await provisionedSale(`${tag}-repurchase`);
    await store.revokeStudentByEmail(email, "refund");
    assert.ok((await store.findStudentByEmail(email)).revokedAt);
    await store.provisionLicensedStudent(email, "vip", "CD-VIP-REBUY001");
    const student = await store.findStudentByEmail(email);
    assert.equal(student.revokedAt ?? null, null);
    assert.equal(student.tier, "vip");
    const { sessionId } = await store.unlockStudent(email, "CD-DRIVE-2026");
    assert.equal((await store.getSessionAccess(sessionId)).status, "active");
  });

  it("lookups roundtrip and miss cleanly", async () => {
    assert.equal(await store.findStudentByEmail("  "), null);
    assert.equal(await store.findStudentByEmail("nobody@example.com"), null);
    assert.equal(await store.revokeStudentByEmail("nobody@example.com", "refund"), null);
    assert.equal(await store.getWebhookEvent("gumroad", "missing"), null);
    const { saleId, email } = await provisionedSale(`${tag}-lookup`);
    assert.equal((await store.findStudentByEmail(email)).email, email);
    const event = await store.getWebhookEvent("gumroad", saleId);
    assert.equal(event.payload.email, email);
  });
}

describe("revocation (file store)", { skip: HAS_DB }, () => {
  battery("file");

  it("file-mode deliveries persist in the store, not just the process", async () => {
    const { readFile } = await import("node:fs/promises");
    const { saleId } = await provisionedSale("file-persist");
    const raw = await readFile(join(root, ".data/store.json"), "utf8");
    const data = JSON.parse(raw);
    assert.ok(
      data.webhookEvents?.[`gumroad:${saleId}`],
      "expected the sale delivery in .data/store.json",
    );
  });
});

describe("revocation (postgres)", { skip: !HAS_DB }, () => {
  before(async () => {
    await setupTestDb();
  });
  battery("pg");
});

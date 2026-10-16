// Shared licensed unlock: DB hit, revocation refused, Gumroad fallback for
// unknown keys. Used by the JSON route and the form action alike.
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
const jiti = createJiti(join(root, "tests/unlock.test.mjs"));
const store = jiti(join(root, "src/lib/store.ts"));
const unlock = jiti(join(root, "src/lib/unlock.ts"));
const license = jiti(join(root, "src/lib/license.ts"));
const client = jiti(join(root, "src/lib/db/client.ts"));

const ENV_KEYS = ["GUMROAD_PRODUCT_STARTER", "GUMROAD_PRODUCT_CERTIFIED", "GUMROAD_ACCESS_TOKEN"];
const savedEnv = {};
const realFetch = global.fetch;
let n = 0;
const fresh = (p) => `${p}-${Date.now()}-${n++}`;

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.GUMROAD_PRODUCT_STARTER = "prod_starter";
  process.env.GUMROAD_PRODUCT_CERTIFIED = "prod_cert";
  delete process.env.GUMROAD_ACCESS_TOKEN;
});
afterEach(() => {
  global.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
after(async () => {
  await client.closeDb();
});

function battery(tag) {
  it("unlocks a known key with a live session", async () => {
    const email = `${fresh(`${tag}-known`)}@example.com`;
    const key = license.generateLicenseKey("certified");
    await store.provisionLicensedStudent(email, "certified", key);
    const result = await unlock.unlockWithLicense(key);
    assert.equal(result.ok, true);
    assert.equal(result.tier, "certified");
    const access = await store.getSessionAccess(result.sessionId);
    assert.equal(access.status, "active");
    assert.equal(access.student.email, email);
  });

  it("refuses revoked keys", async () => {
    const email = `${fresh(`${tag}-rev`)}@example.com`;
    const key = license.generateLicenseKey("starter");
    await store.provisionLicensedStudent(email, "starter", key);
    await store.revokeStudentByEmail(email, "refund");
    assert.deepEqual(await unlock.unlockWithLicense(key), {
      ok: false,
      error: store.REVOKED_ERROR,
    });
  });

  it("falls back to Gumroad for unknown keys, then provisions", async () => {
    const key = "CD-CERTIFIED-AAAAAAAA";
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, purchase: { email: `${fresh(`${tag}-gum`)}@example.com` } }),
    });
    const result = await unlock.unlockWithLicense(key);
    assert.equal(result.ok, true);
    assert.equal(result.tier, "certified");
    const found = await store.findStudentByLicenseKey(key);
    assert.ok(found);
  });

  it("rejects unknown keys Gumroad does not know", async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: false }),
    });
    assert.deepEqual(await unlock.unlockWithLicense("CD-VIP-BBBBBBBB"), {
      ok: false,
      error: "License not recognized.",
    });
  });

  it("rejects unknown keys without calling Gumroad when unconfigured", async () => {
    delete process.env.GUMROAD_PRODUCT_STARTER;
    let called = false;
    global.fetch = async () => {
      called = true;
      throw new Error("must not call");
    };
    assert.deepEqual(await unlock.unlockWithLicense("CD-STARTER-CCCCCCCC"), {
      ok: false,
      error: "License not recognized.",
    });
    assert.equal(called, false);
  });

  it("rejects malformed keys without touching the network", async () => {
    global.fetch = async () => {
      throw new Error("must not call");
    };
    assert.deepEqual(await unlock.unlockWithLicense("CD-GOLD-AAAAAAAA"), {
      ok: false,
      error: "License not recognized.",
    });
  });
}

describe("licensed unlock (file store)", { skip: HAS_DB }, () => {
  battery("file");
});

describe("licensed unlock (postgres)", { skip: !HAS_DB }, () => {
  before(async () => {
    await setupTestDb();
  });
  battery("pg");
});

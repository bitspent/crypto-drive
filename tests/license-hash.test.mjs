// License hashing: determinism, pepper dependence, prod gate, and the
// backfill script's post-migration no-op (raw column already dropped).
import { describe, it, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashLicenses } from "../scripts/hash-licenses.mjs";

const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/license-hash.test.mjs"));
const license = jiti(join(root, "src/lib/license.ts"));
const client = jiti(join(root, "src/lib/db/client.ts"));
after(async () => {
  await client.closeDb();
});

const ENV_KEYS = ["LICENSE_PEPPER", "NODE_ENV"];
const savedEnv = {};
beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("license hashing", () => {
  it("is deterministic sha256(key + pepper), trimmed", () => {
    process.env.LICENSE_PEPPER = "pep";
    const a = license.hashLicenseKey("CD-VIP-AAAAAAAA");
    const b = license.hashLicenseKey("  CD-VIP-AAAAAAAA  ");
    assert.equal(a, b);
    assert.equal(a, createHash("sha256").update("CD-VIP-AAAAAAAA" + "pep").digest("hex"));
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it("depends on the pepper", () => {
    process.env.LICENSE_PEPPER = "one";
    const a = license.hashLicenseKey("CD-VIP-AAAAAAAA");
    process.env.LICENSE_PEPPER = "two";
    assert.notEqual(license.hashLicenseKey("CD-VIP-AAAAAAAA"), a);
  });

  it("fails closed in production without a pepper", () => {
    delete process.env.LICENSE_PEPPER;
    process.env.NODE_ENV = "production";
    assert.throws(() => license.hashLicenseKey("CD-VIP-AAAAAAAA"), /LICENSE_PEPPER/);
  });

  it("stored lookups match the hash, never the raw key", async () => {
    const store = jiti(join(root, "src/lib/store.ts"));
    process.env.LICENSE_PEPPER = "test-pepper";
    const key = license.generateLicenseKey("certified");
    const email = `hash-${Date.now()}@example.com`;
    await store.provisionLicensedStudent(email, "certified", key);
    const found = await store.findStudentByLicenseKey(key);
    assert.equal(found?.email, email);
    assert.equal(found?.licenseKeyHash, license.hashLicenseKey(key));
    assert.ok(!found?.licenseKeyHash?.includes("CD-"));
  });

  it("backfill no-ops once the raw column is gone", async () => {
    if (!HAS_DB) {
      console.log("skip: DATABASE_URL not set (pg pass only)");
      return;
    }
    process.env.LICENSE_PEPPER = "test-pepper";
    // The test DB migrates through 0005, so license_key no longer exists.
    assert.deepEqual(await hashLicenses(), { hashed: 0, note: "raw column gone" });
  });
});

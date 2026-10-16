// Central demo gate: isValidLicense rejects demo keys in real production
// (no ALLOW override), accepts them in dev and in test harnesses.
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/demo-gate.test.mjs"));
const store = jiti(join(root, "src/lib/store.ts"));

const savedEnv = { ...process.env };

beforeEach(() => {
  delete process.env.DATABASE_URL; // file-backed tier index is enough here
});
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("demo gate", () => {
  it("rejects demo keys in real production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEMO_LICENSES;
    assert.equal(await store.isValidLicense("CD-DRIVE-2026"), false);
  });

  it("accepts demo keys with the harness override", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEMO_LICENSES = "1";
    assert.equal(await store.isValidLicense("CD-DRIVE-2026"), true);
  });

  it("accepts demo keys outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ALLOW_DEMO_LICENSES;
    assert.equal(await store.isValidLicense("CD-DRIVE-2026"), true);
  });
});

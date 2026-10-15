// CERT_HASH_SECRET gates production boot, warns-and-falls-back elsewhere.
// Run with: node --test tests/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load the real server store in a fresh process via jiti (it is TypeScript).
const LOAD_STORE = `
const { createRequire } = require("node:module");
const req = createRequire(${JSON.stringify(join(root, "package.json"))});
const { createJiti } = req("jiti");
const jiti = createJiti(${JSON.stringify(join(root, "tests", "cert-secret.test.mjs"))});
jiti(${JSON.stringify(join(root, "src", "lib", "store.ts"))});
console.log("store loaded");
`;

function loadIn(env) {
  return execFileSync(process.execPath, ["-e", LOAD_STORE], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("CERT_HASH_SECRET production gate", () => {
  it("throws when importing the store in production without a secret", () => {
    try {
      loadIn({ NODE_ENV: "production", CERT_HASH_SECRET: "" });
    } catch (err) {
      const text = String(err.stderr ?? "") + String(err.message ?? "");
      assert.match(text, /CERT_HASH_SECRET must be set in production/);
      return;
    }
    assert.fail("expected production boot without a secret to throw");
  });

  it("loads in production with a secret set", () => {
    const out = loadIn({ NODE_ENV: "production", CERT_HASH_SECRET: "test-secret-xyz" });
    assert.match(out, /store loaded/);
  });

  it("loads outside production without a secret", () => {
    const out = loadIn({ NODE_ENV: "test", CERT_HASH_SECRET: "" });
    assert.match(out, /store loaded/);
  });
});

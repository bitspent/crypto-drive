// Deploy health signal: file fallback, live Postgres, unreachable DB.
import { describe, it, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/health.test.mjs"));
const health = jiti(join(root, "src/lib/health.ts"));
const client = jiti(join(root, "src/lib/db/client.ts"));

const savedEnv = { ...process.env };
const REAL_URL = savedEnv.DATABASE_URL?.trim() || "";

beforeEach(() => {
  client.resetDbForTests();
  delete process.env.DATABASE_URL;
  delete process.env.BITCOIN_MODE;
});
afterEach(() => {
  process.env = { ...savedEnv };
  client.resetDbForTests();
});
after(async () => {
  await client.closeDb();
});

describe("health", () => {
  it("reports file fallback without DATABASE_URL", async () => {
    assert.deepEqual(await health.getHealth(), {
      ok: true,
      db: "file",
      bitcoin: "simulated",
    });
  });

  it("echoes BITCOIN_MODE", async () => {
    process.env.BITCOIN_MODE = "regtest";
    assert.equal((await health.getHealth()).bitcoin, "regtest");
  });

  it("reports unreachable when Postgres refuses", async () => {
    process.env.DATABASE_URL = "postgres://127.0.0.1:1/nope";
    assert.deepEqual(await health.getHealth(), {
      ok: false,
      db: "unreachable",
      bitcoin: "simulated",
    });
  });

  it("reports postgres against a live database", async () => {
    if (!REAL_URL) {
      console.log("skip: DATABASE_URL not set (pg pass only)");
      return;
    }
    process.env.DATABASE_URL = REAL_URL;
    assert.deepEqual(await health.getHealth(), {
      ok: true,
      db: "postgres",
      bitcoin: "simulated",
    });
  });
});

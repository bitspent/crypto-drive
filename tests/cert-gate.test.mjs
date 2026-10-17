// Cert gate: /api/complete mints nothing unless the cert step (final exam)
// is passed. Runs against the file store, or Postgres when DATABASE_URL is
// set (serial pg pass). The happy path (pass exam -> issue) is the walk e2e.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setupTestDb } from "../scripts/db-test-setup.mjs";

const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/cert-gate.test.mjs"));
const store = jiti(join(root, "src/lib/store.ts"));
const client = jiti(join(root, "src/lib/db/client.ts"));

let n = 0;
const fresh = (p) => `${p}-${Date.now()}-${n++}`;

after(async () => {
  await client.closeDb();
});

function battery(tag) {
  it("rejects a direct issue with no exam pass", async () => {
    const email = `${fresh(`${tag}-gate`)}@example.com`;
    const { sessionId } = await store.unlockStudent(email, "CD-DRIVE-2026");
    await assert.rejects(
      store.issueCertificate({
        sessionId,
        studentName: "Gate Crasher",
        moduleSlug: "btc-prove-exam",
      }),
      /final exam/,
    );
  });
}

describe("cert gate (file store)", { skip: HAS_DB }, () => {
  battery("file");
});

describe("cert gate (postgres)", { skip: !HAS_DB }, () => {
  before(async () => {
    await setupTestDb();
  });
  battery("pg");
});

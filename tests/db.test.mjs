// Postgres store: round-trips, migration idempotency, concurrent writes.
// Needs DATABASE_URL (local Docker Postgres); skipped without it.
// Run with: DATABASE_URL=... node --test tests/db.test.mjs
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { setupTestDb } from "../scripts/db-test-setup.mjs";

const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/db.test.mjs"));
const store = jiti(join(root, "src/lib/store.ts"));
const migrate = jiti(join(root, "src/lib/db/migrate.ts"));
const client = jiti(join(root, "src/lib/db/client.ts"));
const schema = jiti(join(root, "src/lib/db/schema.ts"));

const LICENSE = "CD-DRIVE-2026";
const email = (n) => `dbtest-${n}-${Date.now()}@example.com`;

describe("postgres store", { skip: !HAS_DB }, () => {
  before(async () => {
    await setupTestDb();
  });

  after(async () => {
    await client.closeDb();
  });

  it("unlock creates students and resolves sessions", async () => {
    const first = await store.unlockStudent(email("a"), LICENSE);
    assert.equal(first.student.email.startsWith("dbtest-a-"), true);
    assert.ok(first.student.practiceSeed);
    const again = await store.getStudentBySession(first.sessionId);
    assert.equal(again?.id, first.student.id);
    assert.equal(await store.getStudentBySession("ses_nope"), null);
    assert.equal(await store.getStudentBySession(undefined), null);
  });

  it("second unlock updates tier without duplicating", async () => {
    const addr = email("b");
    const first = await store.unlockStudent(addr, LICENSE);
    const second = await store.unlockStudent(addr, LICENSE);
    assert.equal(second.student.id, first.student.id);
    assert.notEqual(second.sessionId, first.sessionId);
    assert.equal(second.tier, "certified");
  });

  it("wallet state round-trips as jsonb", async () => {
    const { sessionId } = await store.unlockStudent(email("c"), LICENSE);
    assert.equal(await store.getWalletForSession(sessionId), null);
    const created = await store.createWalletForSession(sessionId);
    assert.equal(created.seedWords.length, 12);
    assert.match(created.address, /^bc1q/);
    // Idempotent re-create returns the same wallet.
    const again = await store.createWalletForSession(sessionId);
    assert.equal(again.address, created.address);
    await store.saveWalletForSession(sessionId, { ...created, balance: 123 });
    assert.equal((await store.getWalletForSession(sessionId))?.balance, 123);
    await store.clearWalletForSession(sessionId);
    assert.equal(await store.getWalletForSession(sessionId), null);
  });

  it("expired sessions read as signed out", async () => {
    const { sessionId, student } = await store.unlockStudent(email("d"), LICENSE);
    assert.ok(await store.getStudentBySession(sessionId));
    const db = client.getDb();
    await db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.sessions.id, sessionId));
    assert.equal(await store.getStudentBySession(sessionId), null);
    assert.ok(student.id);
  });

  it("unknown certificate reads null", async () => {
    assert.equal(await store.getCertificate("cert_nope"), null);
    assert.equal(await store.getTrackCertificate("stu_nope", "bitcoin"), null);
  });

  it("migrate-from-file is idempotent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cd-mig-"));
    const file = join(dir, "store.json");
    const fixture = {
      students: {
        stu_fixture: {
          id: "stu_fixture",
          email: "fixture@example.com",
          name: "Fixture",
          tier: "certified",
          unlockedAt: "2026-01-01T00:00:00.000Z",
          practiceSeed: "abc123",
          modulesPassed: { satoshi: "2026-01-02T00:00:00.000Z" },
          module1PassedAt: "2026-01-03T00:00:00.000Z",
          wallet: {
            exists: true,
            seedWords: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"],
            address: "bc1qfixture",
            balance: 7,
            history: [],
            confirmedThreshold: 3,
            backupAt: null,
          },
        },
      },
      sessions: { ses_fixture: "stu_fixture" },
      certificates: {
        cert_fixture: {
          id: "cert_fixture",
          hash: "deadbeef",
          studentId: "stu_fixture",
          studentName: "Fixture",
          email: "fixture@example.com",
          tier: "certified",
          trackSlug: "bitcoin",
          moduleSlug: "prove-it",
          module: "Prove It",
          milestone: "Capstone",
          issuedAt: "2026-01-04T00:00:00.000Z",
        },
      },
    };
    writeFileSync(file, JSON.stringify(fixture));
    const first = await migrate.migrateFromFile(file);
    const second = await migrate.migrateFromFile(file);
    assert.deepEqual(first, { students: 1, sessions: 1, certificates: 1 });
    assert.deepEqual(second, first);

    const student = await store.getStudentBySession("ses_fixture");
    assert.equal(student?.email, "fixture@example.com");
    assert.equal(student?.modulesPassed.satoshi, "2026-01-02T00:00:00.000Z");
    assert.equal(student?.modulesPassed["btc-explorer"], "2026-01-03T00:00:00.000Z");
    assert.equal(student?.wallet?.balance, 7);
    const cert = await store.getCertificate("cert_fixture");
    assert.equal(cert?.hash, "deadbeef");
    assert.equal(cert?.trackSlug, "bitcoin");
  });

  it("concurrent unlock and progress writes do not clobber", async () => {
    const addr = email("e");
    const { sessionId } = await store.unlockStudent(addr, LICENSE);
    await Promise.all([
      store.passStep(sessionId, "btc-intro-satoshi"),
      store.passStep(sessionId, "btc-intro-satoshi"),
      store.unlockStudent(addr, LICENSE),
      store.createWalletForSession(sessionId),
    ]);
    const student = await store.getStudentBySession(sessionId);
    assert.ok(student?.modulesPassed["btc-intro-satoshi"]);
    assert.equal(student?.tier, "certified");
    assert.equal(student?.wallet?.seedWords.length, 12);
  });
});

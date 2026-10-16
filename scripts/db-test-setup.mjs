// Test/local Postgres setup: applies db/migrations/0001_init.sql, truncates.
// Used by tests/db.test.mjs and by hand: DATABASE_URL=... node scripts/db-test-setup.mjs
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function setupTestDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL must be set for Postgres tests.");
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(join(root, "db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const ddl = await readFile(join(root, "db/migrations", file), "utf8");
      // Our DDL has no semicolons inside statements; strip full-line comments.
      const statements = ddl
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await sql.unsafe(stmt);
      }
    }
    await sql`TRUNCATE students, sessions, certificates, webhook_events CASCADE`;
  } finally {
    await sql.end();
  }
}

const invoked = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invoked) {
  await setupTestDb();
  console.log("test database ready");
}

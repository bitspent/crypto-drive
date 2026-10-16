// One-shot backfill: license_key -> license_key_hash (sha256 + pepper).
// Run AFTER 0004 and BEFORE 0005 (0005 drops the raw column):
//   LICENSE_PEPPER=... DATABASE_URL=... node scripts/hash-licenses.mjs
// Idempotent: only rows with a raw key and no hash are touched. After 0005
// the raw column is gone and the script reports nothing to do.
import postgres from "postgres";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "scripts/hash-licenses.mjs"));
const { hashLicenseKey } = jiti(join(root, "src/lib/license.ts"));

export async function hashLicenses() {
  const pepper = process.env.LICENSE_PEPPER?.trim();
  if (!pepper) throw new Error("LICENSE_PEPPER must be set to hash licenses.");
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL must be set to hash licenses.");
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    let rows;
    try {
      rows = await sql`
        SELECT id, license_key FROM students
        WHERE license_key_hash IS NULL AND license_key IS NOT NULL
      `;
    } catch (e) {
      // 42703 undefined column: 0005 already dropped license_key.
      if (e?.code === "42703") return { hashed: 0, note: "raw column gone" };
      throw e;
    }
    for (const row of rows) {
      await sql`
        UPDATE students SET license_key_hash = ${hashLicenseKey(row.license_key)}
        WHERE id = ${row.id}
      `;
    }
    return { hashed: rows.length };
  } finally {
    await sql.end();
  }
}

const invoked = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invoked) {
  const result = await hashLicenses();
  console.log(
    result.hashed > 0
      ? `hashed ${result.hashed} license(s)`
      : "nothing to hash (no raw keys without hashes)",
  );
}

// One-shot file → Postgres migration. Run with:
//   DATABASE_URL=... node scripts/migrate-from-file.mjs [path/to/store.json]
// Idempotent: safe to re-run.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url);
const { migrateFromFile } = jiti("../src/lib/db/migrate.ts");
const { closeDb } = jiti("../src/lib/db/client.ts");

const counts = await migrateFromFile(process.argv[2]);
console.log(
  `migrated students=${counts.students} sessions=${counts.sessions} certificates=${counts.certificates}`,
);
await closeDb();

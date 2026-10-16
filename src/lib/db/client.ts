import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let db: PostgresJsDatabase<typeof schema> | null = null;
let raw: ReturnType<typeof postgres> | null = null;
let warnedFallback = false;

/** True when a Postgres URL is configured (Supabase pooler or local). */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Warn once when running on the file store instead of Postgres. */
export function warnFileFallbackOnce(): void {
  if (warnedFallback || hasDatabase()) return;
  warnedFallback = true;
  console.warn(
    "[crypto-drive] DATABASE_URL not set. Using .data file store. Do not deploy like this.",
  );
}

/** Process singleton. Throws when DATABASE_URL is unset — check first. */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (db) return db;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL must be set to use Postgres.");
  // prepare:false: the Supabase transaction pooler (6543) cannot hold
  // prepared statements across checkouts.
  raw = postgres(url, { prepare: false, max: 5 });
  db = drizzle(raw, { schema });
  return db;
}

/** Test escape hatch: drop the singleton so the next call reconnects. */
export function resetDbForTests(): void {
  db = null;
}

/** Drain the pool so scripts and test runners can exit. */
export async function closeDb(): Promise<void> {
  db = null;
  if (raw) {
    const client = raw;
    raw = null;
    await client.end();
  }
}

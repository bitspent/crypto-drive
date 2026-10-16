import { sql } from "drizzle-orm";
import { getDb } from "./db/client";

export type HealthStatus = {
  ok: boolean;
  db: "postgres" | "file" | "unreachable";
  bitcoin: string;
};

/**
 * Deploy smoke signal: is the database reachable, and which Bitcoin backend
 * is active? No auth, no secrets in the response. Vercel Preview/Production
 * checks hit this after every deploy (see docs/deploy-vercel.md).
 */
export async function getHealth(): Promise<HealthStatus> {
  const bitcoin = process.env.BITCOIN_MODE?.trim() || "simulated";
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: true, db: "file", bitcoin };
  }
  try {
    await getDb().execute(sql`SELECT 1`);
    return { ok: true, db: "postgres", bitcoin };
  } catch {
    return { ok: false, db: "unreachable", bitcoin };
  }
}

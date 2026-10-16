import { defineConfig } from "drizzle-kit";

/** Tooling config for `drizzle-kit check` / future diffs. */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://127.0.0.1:5433/postgres",
  },
});

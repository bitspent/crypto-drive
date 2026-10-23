import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { WalletState } from "../wallet";

/** Mirrors db/migrations/*.sql. Those files are the reviewed source. */
export const students = pgTable(
  "students",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    licenseKeyHash: text("license_key_hash"),
    tier: text("tier").notNull(),
    practiceSeed: text("practice_seed"),
    modulesPassed: jsonb("modules_passed")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    wallet: jsonb("wallet").$type<WalletState | null>(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    examStartedAt: timestamp("exam_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Note: students_revoked_idx is a partial index (WHERE revoked_at IS NOT
  // NULL) declared in 0003_revocation.sql only — drizzle index() cannot
  // express the predicate, and the SQL files are the reviewed source.
  (t) => [index("students_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_student_idx").on(t.studentId)],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull().default("gumroad"),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_events_source_idx").on(t.source, t.id)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    trackSlug: text("track_slug").notNull(),
    moduleSlug: text("module_slug").notNull(),
    moduleLabel: text("module_label").notNull(),
    milestone: text("milestone").notNull(),
    hash: text("hash").notNull(),
    studentName: text("student_name").notNull(),
    email: text("email").notNull(),
    tier: text("tier").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("certificates_student_idx").on(t.studentId)],
);

import { readFile } from "fs/promises";
import path from "path";
import { getDb } from "./client";
import { certificates, sessions, students } from "./schema";
import {
  certificateTrack,
  normalizeStudent,
  type Certificate,
  type Student,
} from "../store";

type FileStore = {
  students?: Record<string, Student>;
  certificates?: Record<string, Certificate>;
  sessions?: Record<string, string>;
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Upsert a file store (.data/store.json) into Postgres. Idempotent: re-runs
 * overwrite the same business values (created_at is kept from the first run).
 * Legacy module1PassedAt folds into modules_passed via normalizeStudent.
 */
export async function migrateFromFile(
  storePath: string = path.join(process.cwd(), ".data", "store.json"),
): Promise<{ students: number; sessions: number; certificates: number }> {
  const raw = await readFile(storePath, "utf8").catch(() => null);
  if (!raw) throw new Error(`Store file not found: ${storePath}`);
  const data = JSON.parse(raw) as FileStore;
  const db = getDb();
  const now = new Date();
  let studentCount = 0;
  let sessionCount = 0;
  let certificateCount = 0;

  for (const source of Object.values(data.students ?? {})) {
    const s = normalizeStudent(source);
    const values = {
      email: s.email,
      name: s.name ?? null,
      licenseKeyHash: null as string | null,
      tier: s.tier,
      practiceSeed: s.practiceSeed ?? null,
      modulesPassed: s.modulesPassed,
      wallet: s.wallet ?? null,
      updatedAt: now,
    };
    await db
      .insert(students)
      .values({ id: s.id, ...values, createdAt: now })
      .onConflictDoUpdate({ target: students.id, set: values });
    studentCount++;
  }

  for (const [id, studentId] of Object.entries(data.sessions ?? {})) {
    if (!data.students?.[studentId]) continue;
    await db
      .insert(sessions)
      .values({
        id,
        studentId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      })
      .onConflictDoNothing();
    sessionCount++;
  }

  for (const c of Object.values(data.certificates ?? {})) {
    if (!data.students?.[c.studentId]) continue;
    const values = {
      studentId: c.studentId,
      trackSlug: c.trackSlug ?? certificateTrack(c) ?? "bitcoin",
      moduleSlug: c.moduleSlug ?? "btc-explorer",
      moduleLabel: c.module ?? "",
      milestone: c.milestone ?? "",
      hash: c.hash,
      studentName: c.studentName,
      email: c.email,
      tier: c.tier ?? "certified",
      issuedAt: c.issuedAt ? new Date(c.issuedAt) : now,
    };
    await db
      .insert(certificates)
      .values({ id: c.id, ...values })
      .onConflictDoUpdate({ target: certificates.id, set: values });
    certificateCount++;
  }

  return { students: studentCount, sessions: sessionCount, certificates: certificateCount };
}

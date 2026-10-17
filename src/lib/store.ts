import { createHmac, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { and, eq, gt, sql } from "drizzle-orm";
import {
  getAllTracks,
  getCertTarget,
  getTier,
  getTierIndex,
  isValidDemoLicense,
  resolveTierFromLicense,
  type TierId,
} from "./content";
import { findStep, stepBlockedReason } from "./drive";
import {
  assertCertHashSecret,
  certHashSecret,
  derivePracticeSeed,
  gradeStepAnswer,
  practiceFor,
  type StepAnswer,
} from "./practice-samples";
import { createWalletState, type WalletState } from "./wallet";
import { verifyWalletExam } from "./exam";
import { hashLicenseKey, resolveLicenseKind } from "./license";
import { getBitcoinProvider } from "./bitcoin/index";
import { getDb, hasDatabase, warnFileFallbackOnce } from "./db/client";
import { certificates, sessions, students, webhookEvents } from "./db/schema";

assertCertHashSecret();

export type Student = {
  id: string;
  email: string;
  name: string | null;
  /** sha256(CD-<TIER>-<8> + pepper). Raw keys are never stored. NULL for demo. */
  licenseKeyHash?: string | null;
  tier: TierId;
  unlockedAt: string;
  /** Stable hash from email + license. Drives unique practice values. */
  practiceSeed?: string;
  /** ISO timestamps keyed by milestone id (e.g. btc-explorer) */
  modulesPassed: Record<string, string>;
  /** Practice wallet sandbox state. Absent until the learner creates one. */
  wallet?: WalletState | null;
  /** Set by refund/dispute/cancellation webhooks. Revoked students unlock nothing. */
  revokedAt?: string | null;
  revocationReason?: string | null;
  /** @deprecated Slice 1 field — kept for old store files */
  module1PassedAt?: string | null;
};

/** Thrown and surfaced verbatim when a revoked license tries to unlock. */
export const REVOKED_ERROR = "This license has been revoked.";

export type Certificate = {
  id: string;
  hash: string;
  studentId: string;
  studentName: string;
  email: string;
  tier: TierId;
  /** Course this certificate belongs to. One cert per student per track. */
  trackSlug?: string;
  moduleSlug: string;
  module: string;
  milestone: string;
  issuedAt: string;
};

type StoreData = {
  students: Record<string, Student>;
  certificates: Record<string, Certificate>;
  sessions: Record<string, string>;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

/** Sessions live 30 days in Postgres. The file fallback never expires. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Postgres when configured, else the legacy file store (warned, dev only). */
function shouldUsePostgres(): boolean {
  if (hasDatabase()) return true;
  warnFileFallbackOnce();
  return false;
}

const emptyStore = (): StoreData => ({
  students: {},
  certificates: {},
  sessions: {},
});

async function ensureStore(): Promise<StoreData> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch {
    const data = emptyStore();
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
    return data;
  }
}

async function saveStore(data: StoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function normalizeStudent(raw: Student): Student {
  const modulesPassed = { ...(raw.modulesPassed ?? {}) };
  if (raw.module1PassedAt && !modulesPassed["btc-explorer"]) {
    // Legacy Module 1 pass → count as first Bitcoin milestone for demos
    modulesPassed["btc-explorer"] = raw.module1PassedAt;
  }
  if (modulesPassed["wallet-foundations"] && !modulesPassed["btc-explorer"]) {
    modulesPassed["btc-explorer"] = modulesPassed["wallet-foundations"];
  }
  return {
    ...raw,
    tier: raw.tier ?? "certified",
    modulesPassed,
  };
}

/** @deprecated Prefer getDemoLicenseKeys — kept for README copy */
export function getDemoLicenseKey(): string {
  return process.env.DEMO_LICENSE_KEY?.trim() || "CD-DRIVE-2026";
}

export async function isValidLicense(key: string): Promise<boolean> {
  // Central demo gate: demo keys are dead in real production no matter which
  // unlock path asks (form action or JSON route). Test harnesses set
  // ALLOW_DEMO_LICENSES=1; see resolveLicenseKind.
  if (resolveLicenseKind(key) === "demo-blocked") return false;
  const index = await getTierIndex();
  if (isValidDemoLicense(key, index)) return true;
  const envKey = getDemoLicenseKey();
  return key.trim().toUpperCase() === envKey.toUpperCase();
}

type StudentRow = typeof students.$inferSelect;
type CertificateRow = typeof certificates.$inferSelect;

function studentFromRow(row: StudentRow): Student {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    licenseKeyHash: row.licenseKeyHash ?? undefined,
    tier: row.tier as TierId,
    unlockedAt: row.createdAt.toISOString(),
    practiceSeed: row.practiceSeed ?? undefined,
    modulesPassed: { ...((row.modulesPassed as Record<string, string> | null) ?? {}) },
    wallet: (row.wallet as WalletState | null | undefined) ?? undefined,
    revokedAt: row.revokedAt?.toISOString() ?? undefined,
    revocationReason: row.revocationReason ?? undefined,
  };
}

function certificateFromRow(row: CertificateRow): Certificate {
  return {
    id: row.id,
    hash: row.hash,
    studentId: row.studentId,
    studentName: row.studentName,
    email: row.email,
    tier: row.tier as TierId,
    trackSlug: row.trackSlug,
    moduleSlug: row.moduleSlug,
    module: row.moduleLabel,
    milestone: row.milestone,
    issuedAt: row.issuedAt.toISOString(),
  };
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "23505";
}

/** Live session's student row, or null when unknown or expired. */
async function pgStudentBySession(sessionId: string): Promise<StudentRow | null> {
  const db = getDb();
  const rows = await db
    .select({ student: students })
    .from(sessions)
    .innerJoin(students, eq(students.id, sessions.studentId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  return rows[0]?.student ?? null;
}

export async function unlockStudent(
  email: string,
  license: string,
): Promise<{
  student: Student;
  sessionId: string;
  tier: TierId;
}> {
  if (shouldUsePostgres()) return pgUnlockStudent(email, license);
  const data = await ensureStore();
  const normalized = email.trim().toLowerCase();

  let tier = await resolveTierFromLicense(license);
  if (!tier) {
    tier = "certified";
  }

  let student = Object.values(data.students).find((s) => s.email === normalized);

  const practiceSeed = derivePracticeSeed(normalized, license);

  if (!student) {
    student = {
      id: newId("stu"),
      email: normalized,
      name: null,
      tier,
      unlockedAt: new Date().toISOString(),
      practiceSeed,
      modulesPassed: {},
    };
    data.students[student.id] = student;
  } else {
    student = normalizeStudent(student);
    if (student.revokedAt) throw new Error(REVOKED_ERROR);
    student.tier = tier;
    if (!student.practiceSeed) student.practiceSeed = practiceSeed;
    data.students[student.id] = student;
  }

  const sessionId = newId("ses");
  data.sessions[sessionId] = student.id;
  await saveStore(data);
  return { student, sessionId, tier };
}

async function pgUnlockStudent(
  email: string,
  license: string,
): Promise<{ student: Student; sessionId: string; tier: TierId }> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  let tier = await resolveTierFromLicense(license);
  if (!tier) tier = "certified";
  const practiceSeed = derivePracticeSeed(normalized, license);

  let row =
    (await db.select().from(students).where(eq(students.email, normalized)).limit(1))[0] ??
    null;
  if (!row) {
    try {
      const inserted = await db
        .insert(students)
        .values({
          id: newId("stu"),
          email: normalized,
          name: null,
          tier,
          practiceSeed,
          modulesPassed: {},
        })
        .returning();
      row = inserted[0] ?? null;
    } catch (e) {
      // Lost an insert race: fall through to the winner's row.
      if (!isUniqueViolation(e)) throw e;
      row =
        (await db.select().from(students).where(eq(students.email, normalized)).limit(1))[0] ??
        null;
    }
  }
  if (!row) throw new Error("Unlock with your license before you continue.");
  if (row.revokedAt) throw new Error(REVOKED_ERROR);
  await db
    .update(students)
    .set({
      tier,
      ...(row.practiceSeed ? {} : { practiceSeed }),
      updatedAt: new Date(),
    })
    .where(eq(students.id, row.id));

  const sessionId = newId("ses");
  await db.insert(sessions).values({
    id: sessionId,
    studentId: row.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  const student = normalizeStudent(
    studentFromRow({ ...row, tier, practiceSeed: row.practiceSeed ?? practiceSeed }),
  );
  return { student, sessionId, tier };
}

export async function getStudentBySession(
  sessionId: string | undefined,
): Promise<Student | null> {
  if (!sessionId) return null;
  if (shouldUsePostgres()) {
    const row = await pgStudentBySession(sessionId);
    if (!row) return null;
    return normalizeStudent(studentFromRow(row));
  }
  const data = await ensureStore();
  const studentId = data.sessions[sessionId];
  if (!studentId) return null;
  const student = data.students[studentId];
  if (!student) return null;
  return normalizeStudent(student);
}

export type SessionAccess =
  | { status: "active"; student: Student }
  | { status: "revoked" }
  | { status: "none" };

/**
 * Session gate for every student API: active students pass, unknown sessions
 * 401, and revoked students 403 with their session deleted — the next request
 * after a mid-session revocation fails, and the one after that is anonymous.
 */
export async function getSessionAccess(
  sessionId: string | undefined,
): Promise<SessionAccess> {
  if (!sessionId) return { status: "none" };
  if (shouldUsePostgres()) {
    const db = getDb();
    const row = await pgStudentBySession(sessionId);
    if (!row) return { status: "none" };
    if (row.revokedAt) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      return { status: "revoked" };
    }
    return { status: "active", student: normalizeStudent(studentFromRow(row)) };
  }
  const data = await ensureStore();
  const studentId = data.sessions[sessionId];
  const student = studentId ? data.students[studentId] : undefined;
  if (!studentId || !student) return { status: "none" };
  if (student.revokedAt) {
    delete data.sessions[sessionId];
    await saveStore(data);
    return { status: "revoked" };
  }
  return { status: "active", student: normalizeStudent(student) };
}

/** Find a student by email (webhook revocation looks up the sale email). */
export async function findStudentByEmail(email: string): Promise<Student | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  if (shouldUsePostgres()) {
    const rows = await getDb()
      .select()
      .from(students)
      .where(eq(students.email, normalized))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return normalizeStudent(studentFromRow(row));
  }
  const data = await ensureStore();
  const found = Object.values(data.students).find((s) => s.email === normalized);
  if (!found) return null;
  return normalizeStudent(found);
}

/**
 * Revoke a student's access (refund, dispute, cancellation). Idempotent:
 * re-revoking updates the timestamp and reason. Returns null when the email
 * has no student (sale predates the webhook, or test noise).
 */
export async function revokeStudentByEmail(
  email: string,
  reason: string,
): Promise<Student | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const at = new Date().toISOString();
  if (shouldUsePostgres()) {
    const db = getDb();
    const updated = await db
      .update(students)
      .set({ revokedAt: new Date(at), revocationReason: reason, updatedAt: new Date() })
      .where(eq(students.email, normalized))
      .returning();
    const row = updated[0];
    if (!row) return null;
    return normalizeStudent(studentFromRow(row));
  }
  const data = await ensureStore();
  const found = Object.values(data.students).find((s) => s.email === normalized);
  if (!found) return null;
  found.revokedAt = at;
  found.revocationReason = reason;
  data.students[found.id] = found;
  await saveStore(data);
  return normalizeStudent(found);
}

/** The learner's practice wallet, or null when none exists yet. */
export async function getWalletForSession(
  sessionId: string | undefined,
): Promise<WalletState | null> {
  const student = await getStudentBySession(sessionId);
  if (!student?.wallet?.exists) return null;
  return student.wallet;
}

/**
 * Create the practice wallet from the learner's practice seed — the SAME
 * address and words as the drives. Idempotent: returns the existing wallet.
 */
export async function createWalletForSession(sessionId: string | undefined): Promise<WalletState> {
  const student = await getStudentBySession(sessionId);
  if (!student) throw new Error("Unlock with your license before you continue.");
  if (student.wallet?.exists) return student.wallet;
  if (!student.practiceSeed) {
    throw new Error("Unlock again with your license to start practice.");
  }
  const practice = practiceFor(student.practiceSeed);
  // Wallet address follows the active backend's HRP (simulated: same bc1q
  // address as the drives). Drive practice values always stay simulated.
  const address = getBitcoinProvider().getAddressForSeed(student.practiceSeed);
  const wallet = createWalletState({ seedWords: practice.words, address });
  if (shouldUsePostgres()) {
    // Deterministic wallet: concurrent creates write the same value.
    await getDb()
      .update(students)
      .set({ wallet, updatedAt: new Date() })
      .where(eq(students.id, student.id));
    return wallet;
  }
  const data = await ensureStore();
  const stored = data.students[student.id];
  if (!stored) throw new Error("Unlock with your license before you continue.");
  stored.wallet = wallet;
  await saveStore(data);
  return wallet;
}

/** Persist wallet state after a flow mutates it. */
export async function saveWalletForSession(
  sessionId: string | undefined,
  wallet: WalletState,
): Promise<void> {
  const student = await getStudentBySession(sessionId);
  if (!student) throw new Error("Unlock with your license before you continue.");
  if (shouldUsePostgres()) {
    await getDb()
      .update(students)
      .set({ wallet, updatedAt: new Date() })
      .where(eq(students.id, student.id));
    return;
  }
  const data = await ensureStore();
  const stored = data.students[student.id];
  if (!stored) throw new Error("Unlock with your license before you continue.");
  stored.wallet = wallet;
  await saveStore(data);
}

/** Reset the practice wallet: clear state so setup can run again. */
export async function clearWalletForSession(sessionId: string | undefined): Promise<void> {
  const student = await getStudentBySession(sessionId);
  if (!student) throw new Error("Unlock with your license before you continue.");
  if (shouldUsePostgres()) {
    await getDb()
      .update(students)
      .set({ wallet: null, updatedAt: new Date() })
      .where(eq(students.id, student.id));
    return;
  }
  const data = await ensureStore();
  const stored = data.students[student.id];
  if (!stored) throw new Error("Unlock with your license before you continue.");
  stored.wallet = null;
  await saveStore(data);
}

export async function issueCertificate(input: {
  sessionId: string;
  studentName: string;
  moduleSlug: string;
}): Promise<Certificate> {
  if (shouldUsePostgres()) return pgIssueCertificate(input);
  const data = await ensureStore();
  const studentId = data.sessions[input.sessionId];
  if (!studentId) {
    throw new Error("Session expired. Unlock again with your license.");
  }

  const student = normalizeStudent(data.students[studentId]);
  if (!data.students[studentId]) {
    throw new Error("Student not found.");
  }

  const name = input.studentName.trim();
  if (name.length < 2) {
    throw new Error("Enter the name you want on your certificate.");
  }

  const resolved = await getCertTarget(input.moduleSlug);
  if (!resolved) {
    throw new Error("Unknown milestone.");
  }

  const tier = await getTier(student.tier);
  if (!tier.features.certificate || !tier.features.verifyLink) {
    throw new Error(
      "Starter can practice the whole drive. Upgrade to Certified to earn the verify link.",
    );
  }

  const existing = findTrackCertificate(
    data.certificates,
    student.id,
    resolved.trackSlug,
    input.moduleSlug,
  );
  if (existing) {
    student.name = student.name ?? name;
    student.modulesPassed[input.moduleSlug] =
      student.modulesPassed[input.moduleSlug] ?? new Date().toISOString();
    data.students[student.id] = student;
    await saveStore(data);
    return existing;
  }

  student.name = name;
  student.modulesPassed[input.moduleSlug] = new Date().toISOString();

  const id = newId("cert");
  const issuedAt = new Date().toISOString();
  const secret = certHashSecret();
  const hash = createHmac("sha256", secret)
    .update(
      `${id}|${name}|${student.email}|${issuedAt}|${input.moduleSlug}|${student.tier}`,
    )
    .digest("hex")
    .slice(0, 24);

  const certificate: Certificate = {
    id,
    hash,
    studentId: student.id,
    studentName: name,
    email: student.email,
    tier: student.tier,
    trackSlug: resolved.trackSlug,
    moduleSlug: input.moduleSlug,
    module: resolved.certModuleLabel,
    milestone: resolved.certMilestoneLabel,
    issuedAt,
  };

  data.certificates[id] = certificate;
  data.students[student.id] = student;
  await saveStore(data);
  return certificate;
}

async function pgIssueCertificate(input: {
  sessionId: string;
  studentName: string;
  moduleSlug: string;
}): Promise<Certificate> {
  const db = getDb();
  const student = await getStudentBySession(input.sessionId);
  if (!student) {
    throw new Error("Session expired. Unlock again with your license.");
  }

  const name = input.studentName.trim();
  if (name.length < 2) {
    throw new Error("Enter the name you want on your certificate.");
  }

  const resolved = await getCertTarget(input.moduleSlug);
  if (!resolved) {
    throw new Error("Unknown milestone.");
  }

  const tier = await getTier(student.tier);
  if (!tier.features.certificate || !tier.features.verifyLink) {
    throw new Error(
      "Starter can practice the whole drive. Upgrade to Certified to earn the verify link.",
    );
  }

  const rows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.studentId, student.id));
  const existing = findTrackCertificate(
    Object.fromEntries(rows.map((r) => [r.id, certificateFromRow(r)])),
    student.id,
    resolved.trackSlug,
    input.moduleSlug,
  );
  const now = new Date();
  if (existing) {
    await db
      .update(students)
      .set({
        ...(student.name == null ? { name } : {}),
        ...(student.modulesPassed[input.moduleSlug]
          ? {}
          : {
              modulesPassed: sql`${students.modulesPassed} || ${JSON.stringify({
                [input.moduleSlug]: now.toISOString(),
              })}::jsonb`,
            }),
        updatedAt: now,
      })
      .where(eq(students.id, student.id));
    return existing;
  }

  const id = newId("cert");
  const issuedAt = now.toISOString();
  const secret = certHashSecret();
  const hash = createHmac("sha256", secret)
    .update(
      `${id}|${name}|${student.email}|${issuedAt}|${input.moduleSlug}|${student.tier}`,
    )
    .digest("hex")
    .slice(0, 24);

  await db.insert(certificates).values({
    id,
    hash,
    studentId: student.id,
    studentName: name,
    email: student.email,
    tier: student.tier,
    trackSlug: resolved.trackSlug,
    moduleSlug: input.moduleSlug,
    moduleLabel: resolved.certModuleLabel,
    milestone: resolved.certMilestoneLabel,
    issuedAt: now,
  });
  await db
    .update(students)
    .set({
      name,
      modulesPassed: sql`${students.modulesPassed} || ${JSON.stringify({
        [input.moduleSlug]: issuedAt,
      })}::jsonb`,
      updatedAt: now,
    })
    .where(eq(students.id, student.id));

  return {
    id,
    hash,
    studentId: student.id,
    studentName: name,
    email: student.email,
    tier: student.tier,
    trackSlug: resolved.trackSlug,
    moduleSlug: input.moduleSlug,
    module: resolved.certModuleLabel,
    milestone: resolved.certMilestoneLabel,
    issuedAt,
  };
}

export async function passStep(
  sessionId: string,
  stepId: string,
  answer?: StepAnswer,
): Promise<void> {
  const student = await getStudentBySession(sessionId);
  if (!student) {
    throw new Error("Unlock with your license before you continue.");
  }
  if (!student.practiceSeed) {
    throw new Error("Unlock again with your license to start practice.");
  }

  const tracks = await getAllTracks();
  const match = tracks
    .map((track) => {
      const drives = track.drives ?? [];
      return { drives, hit: findStep(drives, stepId) };
    })
    .find((entry) => entry.hit);
  if (!match?.hit) throw new Error("Unknown step.");
  const blocked = stepBlockedReason(match.drives, stepId, student.modulesPassed);
  if (blocked) throw new Error(blocked);
  const foundStep = match.hit;

  const practice = practiceFor(student.practiceSeed);
  if (foundStep.step.action.type === "wallet-exam") {
    // Async + wallet-backed: graded against the store and the chain, not the
    // practice set. Throws the first incomplete task as a learner message.
    await verifyWalletExam(student, answer);
  } else {
    const gradeError = gradeStepAnswer(
      stepId,
      foundStep.step.action.type,
      practice,
      answer,
    );
    if (gradeError) throw new Error(gradeError);
  }

  if (!student.modulesPassed[stepId]) {
    const stamp = new Date().toISOString();
    if (shouldUsePostgres()) {
      // Atomic jsonb merge: concurrent passes on different steps can't clobber.
      await getDb()
        .update(students)
        .set({
          modulesPassed: sql`${students.modulesPassed} || ${JSON.stringify({
            [stepId]: stamp,
          })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(students.id, student.id));
      return;
    }
    const data = await ensureStore();
    const stored = data.students[student.id];
    if (!stored) throw new Error("Unlock with your license before you continue.");
    stored.modulesPassed[stepId] = stored.modulesPassed[stepId] ?? stamp;
    data.students[student.id] = stored;
    await saveStore(data);
  }
}

export async function getPracticeForSession(
  sessionId: string | undefined,
): Promise<ReturnType<typeof practiceFor> | null> {
  const student = await getStudentBySession(sessionId);
  if (!student?.practiceSeed) return null;
  return practiceFor(student.practiceSeed);
}

/** The student's certificate for a course, if one was already issued. */
export async function getTrackCertificate(
  studentId: string,
  trackSlug: string,
  preferredModuleSlug?: string,
): Promise<Certificate | null> {
  if (shouldUsePostgres()) {
    const rows = await getDb()
      .select()
      .from(certificates)
      .where(eq(certificates.studentId, studentId));
    return findTrackCertificate(
      Object.fromEntries(rows.map((r) => [r.id, certificateFromRow(r)])),
      studentId,
      trackSlug,
      preferredModuleSlug,
    );
  }
  const data = await ensureStore();
  return findTrackCertificate(
    data.certificates,
    studentId,
    trackSlug,
    preferredModuleSlug,
  );
}

function findTrackCertificate(
  certificates: Record<string, Certificate>,
  studentId: string,
  trackSlug: string,
  preferredModuleSlug?: string,
): Certificate | null {
  const matches = Object.values(certificates)
    .filter(
      (cert) =>
        cert.studentId === studentId && certificateTrack(cert) === trackSlug,
    )
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  const preferred = preferredModuleSlug
    ? matches.find((cert) => cert.moduleSlug === preferredModuleSlug)
    : undefined;
  return preferred ?? matches[0] ?? null;
}

export function certificateTrack(cert: Certificate): string | null {
  if (cert.trackSlug) return cert.trackSlug;
  const slug = cert.moduleSlug ?? "";
  const moduleName = cert.module ?? "";
  if (
    slug.startsWith("btc-") ||
    slug === "wallet-foundations" ||
    moduleName.startsWith("Bitcoin")
  ) {
    return "bitcoin";
  }
  if (slug.startsWith("eth-") || moduleName.startsWith("Ethereum")) return "ethereum";
  if (slug.startsWith("usdt-") || moduleName.startsWith("USDT")) return "usdt-networks";
  if (slug.startsWith("trx-") || moduleName.startsWith("Tron")) return "tron";
  if (slug.startsWith("sol-") || moduleName.startsWith("Solana")) return "solana";
  return null;
}

/** Find a student by purchased license key, or null. Demo keys never match. */
export async function findStudentByLicenseKey(key: string): Promise<Student | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;
  const hash = hashLicenseKey(trimmed);
  if (shouldUsePostgres()) {
    const rows = await getDb()
      .select()
      .from(students)
      .where(eq(students.licenseKeyHash, hash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return normalizeStudent(studentFromRow(row));
  }
  const data = await ensureStore();
  const found = Object.values(data.students).find((s) => s.licenseKeyHash === hash);
  if (!found) return null;
  return normalizeStudent(found);
}

/** Mint a session for an already-resolved student (license unlock path). */
export async function createSessionForStudent(studentId: string): Promise<string> {
  const sessionId = newId("ses");
  if (shouldUsePostgres()) {
    await getDb().insert(sessions).values({
      id: sessionId,
      studentId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return sessionId;
  }
  const data = await ensureStore();
  if (!data.students[studentId]) {
    throw new Error("Unlock with your license before you continue.");
  }
  data.sessions[sessionId] = studentId;
  await saveStore(data);
  return sessionId;
}

/**
 * Provision a purchased license: upgrade the demo student on the same email
 * (key + tier; seed and progress stay put) or create a fresh student.
 */
export async function provisionLicensedStudent(
  email: string,
  tier: TierId,
  licenseKey: string,
): Promise<Student> {
  const normalized = email.trim().toLowerCase();
  // The raw key derives the practice seed (stable per email+key) but only
  // its hash is stored.
  const licenseKeyHash = hashLicenseKey(licenseKey);
  if (shouldUsePostgres()) {
    const db = getDb();
    const existing = (
      await db.select().from(students).where(eq(students.email, normalized)).limit(1)
    )[0];
    if (existing) {
      // A successful sale (or a Gumroad re-verification) is positive
      // entitlement evidence: it clears any earlier revocation.
      await db
        .update(students)
        .set({
          licenseKeyHash,
          tier,
          revokedAt: null,
          revocationReason: null,
          updatedAt: new Date(),
        })
        .where(eq(students.id, existing.id));
      return normalizeStudent(
        studentFromRow({
          ...existing,
          licenseKeyHash,
          tier,
          revokedAt: null,
          revocationReason: null,
        }),
      );
    }
    const practiceSeed = derivePracticeSeed(normalized, licenseKey);
    const inserted = await db
      .insert(students)
      .values({
        id: newId("stu"),
        email: normalized,
        name: null,
        licenseKeyHash,
        tier,
        practiceSeed,
        modulesPassed: {},
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Could not create student.");
    return normalizeStudent(studentFromRow(row));
  }
  const data = await ensureStore();
  const existing = Object.values(data.students).find((s) => s.email === normalized);
  if (existing) {
    existing.licenseKeyHash = licenseKeyHash;
    existing.tier = tier;
    delete existing.revokedAt;
    delete existing.revocationReason;
    data.students[existing.id] = existing;
    await saveStore(data);
    return normalizeStudent(existing);
  }
  const student: Student = {
    id: newId("stu"),
    email: normalized,
    name: null,
    licenseKeyHash,
    tier,
    unlockedAt: new Date().toISOString(),
    practiceSeed: derivePracticeSeed(normalized, licenseKey),
    modulesPassed: {},
  };
  data.students[student.id] = student;
  await saveStore(data);
  return normalizeStudent(student);
}

/** Process-wide fallback store for dev file mode (production uses Postgres). */
const fallbackWebhookEvents = new Map<string, Record<string, unknown>>();

/**
 * Record a webhook delivery. Returns true when this id was already seen —
 * callers ack the duplicate without re-provisioning or re-emailing.
 */
export async function recordWebhookEvent(
  source: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (shouldUsePostgres()) {
    const inserted = await getDb()
      .insert(webhookEvents)
      .values({ id, source, payload })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    return inserted.length === 0;
  }
  const key = `${source}:${id}`;
  if (fallbackWebhookEvents.has(key)) return true;
  fallbackWebhookEvents.set(key, payload);
  return false;
}

/** Fetch a recorded delivery (refund handling reads the original sale). */
export async function getWebhookEvent(
  source: string,
  id: string,
): Promise<{ payload: Record<string, unknown> } | null> {
  if (shouldUsePostgres()) {
    const rows = await getDb()
      .select({ payload: webhookEvents.payload })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.source, source), eq(webhookEvents.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { payload: (row.payload as Record<string, unknown>) ?? {} };
  }
  const payload = fallbackWebhookEvents.get(`${source}:${id}`);
  if (!payload) return null;
  return { payload };
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  if (shouldUsePostgres()) {
    const rows = await getDb()
      .select()
      .from(certificates)
      .where(eq(certificates.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const cert = certificateFromRow(row);
    return {
      ...cert,
      tier: cert.tier ?? "certified",
      moduleSlug: cert.moduleSlug ?? "btc-explorer",
    };
  }
  const data = await ensureStore();
  const cert = data.certificates[id];
  if (!cert) return null;
  return {
    ...cert,
    tier: cert.tier ?? "certified",
    moduleSlug: cert.moduleSlug ?? "btc-explorer",
  };
}

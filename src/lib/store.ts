import { createHmac, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
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

assertCertHashSecret();

export type Student = {
  id: string;
  email: string;
  name: string | null;
  tier: TierId;
  unlockedAt: string;
  /** Stable hash from email + license. Drives unique practice values. */
  practiceSeed?: string;
  /** ISO timestamps keyed by milestone id (e.g. btc-explorer) */
  modulesPassed: Record<string, string>;
  /** @deprecated Slice 1 field — kept for old store files */
  module1PassedAt?: string | null;
};

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

function normalizeStudent(raw: Student): Student {
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
  const index = await getTierIndex();
  if (isValidDemoLicense(key, index)) return true;
  const envKey = getDemoLicenseKey();
  return key.trim().toUpperCase() === envKey.toUpperCase();
}

export async function unlockStudent(
  email: string,
  license: string,
): Promise<{
  student: Student;
  sessionId: string;
  tier: TierId;
}> {
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
    student.tier = tier;
    if (!student.practiceSeed) student.practiceSeed = practiceSeed;
    data.students[student.id] = student;
  }

  const sessionId = newId("ses");
  data.sessions[sessionId] = student.id;
  await saveStore(data);
  return { student, sessionId, tier };
}

export async function getStudentBySession(
  sessionId: string | undefined,
): Promise<Student | null> {
  if (!sessionId) return null;
  const data = await ensureStore();
  const studentId = data.sessions[sessionId];
  if (!studentId) return null;
  const student = data.students[studentId];
  if (!student) return null;
  return normalizeStudent(student);
}

export async function issueCertificate(input: {
  sessionId: string;
  studentName: string;
  moduleSlug: string;
}): Promise<Certificate> {
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

export async function passStep(
  sessionId: string,
  stepId: string,
  answer?: StepAnswer,
): Promise<void> {
  const data = await ensureStore();
  const studentId = data.sessions[sessionId];
  if (!studentId || !data.students[studentId]) {
    throw new Error("Unlock with your license before you continue.");
  }

  const student = normalizeStudent(data.students[studentId]);
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
  const gradeError = gradeStepAnswer(
    stepId,
    foundStep.step.action.type,
    practice,
    answer,
  );
  if (gradeError) throw new Error(gradeError);

  if (!student.modulesPassed[stepId]) {
    student.modulesPassed[stepId] = new Date().toISOString();
    data.students[student.id] = student;
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

function certificateTrack(cert: Certificate): string | null {
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

export async function getCertificate(id: string): Promise<Certificate | null> {
  const data = await ensureStore();
  const cert = data.certificates[id];
  if (!cert) return null;
  return {
    ...cert,
    tier: cert.tier ?? "certified",
    moduleSlug: cert.moduleSlug ?? "btc-explorer",
  };
}

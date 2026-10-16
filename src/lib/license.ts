import { randomBytes } from "crypto";

export type LicenseTier = "starter" | "certified" | "vip";

/** Base32 without ambiguous letters: no I, L, O, U and no 0, 1. */
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const LICENSE_RE = /^CD-(STARTER|CERTIFIED|VIP)-([A-HJ-NP-Z2-9]{8})$/;

/** CD-<TIER>-<8 chars>, e.g. CD-CERTIFIED-K3M9P2XQ. */
export function generateLicenseKey(tier: LicenseTier): string {
  const tag = tier.toUpperCase();
  const bytes = randomBytes(8);
  let suffix = "";
  for (const b of bytes) {
    suffix += KEY_ALPHABET[b % KEY_ALPHABET.length];
  }
  return `CD-${tag}-${suffix}`;
}

export function validateLicenseFormat(key: string): boolean {
  return LICENSE_RE.test(key.trim());
}

/** Tier encoded in a well-formed key, or null when the format is wrong. */
export function tierFromLicenseKey(key: string): LicenseTier | null {
  const m = LICENSE_RE.exec(key.trim());
  if (!m) return null;
  return m[1].toLowerCase() as LicenseTier;
}

export type LicenseKind = "licensed" | "demo" | "demo-blocked" | "unknown";

/**
 * Classify an unlock attempt. Demo keys (CD-DRIVE-*) work in dev and in
 * test harnesses that set ALLOW_DEMO_LICENSES=1 (the e2e server runs
 * NODE_ENV=production, so it needs the override); real production rejects
 * them. Licensed keys (CD-<TIER>-<8>) work everywhere.
 */
export function resolveLicenseKind(key: string, env?: NodeJS.ProcessEnv): LicenseKind {
  const e = env ?? process.env;
  const trimmed = key.trim();
  if (validateLicenseFormat(trimmed)) return "licensed";
  if (trimmed.toUpperCase().startsWith("CD-DRIVE-")) {
    if (e.NODE_ENV === "production" && e.ALLOW_DEMO_LICENSES !== "1") {
      return "demo-blocked";
    }
    return "demo";
  }
  return "unknown";
}

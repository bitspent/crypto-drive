import { createHash, createHmac, randomBytes } from "crypto";

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

/**
 * Deterministic key for one sale: HMAC(sale_id, tier) under the webhook
 * secret, mapped onto the same alphabet as random keys. Re-delivery of the
 * same sale — same payment, same key — by construction, so a retried ping
 * can never mint a second key for one purchase. Falls back to the license
 * pepper when the webhook secret is unset (dev/test); the route rejects
 * unauthenticated pings before this is ever reached.
 */
export function deriveLicenseKeyForSale(saleId: string, tier: LicenseTier): string {
  const secret = process.env.GUMROAD_WEBHOOK_SECRET?.trim() || licensePepper();
  const mac = createHmac("sha256", secret)
    .update(`${tier}:${saleId.trim()}`)
    .digest();
  let suffix = "";
  for (let i = 0; suffix.length < 8; i++) {
    suffix += KEY_ALPHABET[mac[i % mac.length] % KEY_ALPHABET.length];
  }
  return `CD-${tier.toUpperCase()}-${suffix}`;
}

let warnedPepper = false;

/**
 * Pepper for license hashing. Required in production (the hash must be
 * stable across deploys); dev and test fall back with a one-time warning.
 */
export function licensePepper(): string {
  const pepper = process.env.LICENSE_PEPPER?.trim();
  if (pepper) return pepper;
  if (process.env.NODE_ENV === "production") {
    throw new Error("LICENSE_PEPPER must be set in production. See .env.example.");
  }
  if (!warnedPepper) {
    warnedPepper = true;
    console.warn(
      "[crypto-drive] LICENSE_PEPPER not set. Using dev fallback. Do not deploy like this.",
    );
  }
  return "crypto-drive-dev-pepper";
}

/**
 * What the database stores: sha256 of the trimmed key plus the pepper.
 * Raw keys exist only in memory (provisioning, unlock lookup, the welcome
 * email) — never at rest, never in logs.
 */
export function hashLicenseKey(key: string): string {
  return createHash("sha256").update(key.trim() + licensePepper()).digest("hex");
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

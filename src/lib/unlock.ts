import type { TierId } from "./content";
import { verifyGumroadLicense } from "./gumroad";
import { tierFromLicenseKey } from "./license";
import {
  createSessionForStudent,
  findStudentByLicenseKey,
  provisionLicensedStudent,
  REVOKED_ERROR,
} from "./store";

export type LicensedUnlockResult =
  | { ok: true; sessionId: string; tier: TierId }
  | { ok: false; error: string };

function productIdForTier(tier: "starter" | "certified" | "vip"): string | null {
  const table = {
    starter: process.env.GUMROAD_PRODUCT_STARTER?.trim(),
    certified: process.env.GUMROAD_PRODUCT_CERTIFIED?.trim(),
    vip: process.env.GUMROAD_PRODUCT_VIP?.trim(),
  } as const;
  return table[tier] || null;
}

/**
 * Unlock with a purchased CD-<TIER>-<8> key. Shared by the JSON route and the
 * unlock form action so both paths accept the same keys: DB lookup first,
 * Gumroad License API for unknown keys, revocation refused everywhere.
 */
export async function unlockWithLicense(license: string): Promise<LicensedUnlockResult> {
  const tier = tierFromLicenseKey(license);
  if (!tier) return { ok: false, error: "License not recognized." };
  const known = await findStudentByLicenseKey(license);
  if (known) {
    if (known.revokedAt) return { ok: false, error: REVOKED_ERROR };
    const sessionId = await createSessionForStudent(known.id);
    return { ok: true, sessionId, tier: known.tier };
  }
  const productId = productIdForTier(tier);
  if (productId) {
    const check = await verifyGumroadLicense(productId, license);
    if (check.ok) {
      const created = await provisionLicensedStudent(check.email, tier, license);
      const sessionId = await createSessionForStudent(created.id);
      return { ok: true, sessionId, tier: created.tier };
    }
  }
  return { ok: false, error: "License not recognized." };
}

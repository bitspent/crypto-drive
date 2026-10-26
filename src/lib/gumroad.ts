import { LRUCache } from "lru-cache";

const VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

export type LicenseCheck = { ok: true; email: string } | { ok: false };

// Verified results are cached per license key: a key already seen in the DB
// short-circuits before this module is even called, so this cache only
// absorbs repeated Gumroad fallbacks (unknown-key unlock retries).
// Accepted verdicts ride 30 days; refusals 24 hours (a buyer may complete
// checkout after a first failed attempt).
const OK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFUSED_TTL_MS = 24 * 60 * 60 * 1000;

const verdicts = new LRUCache<string, LicenseCheck>({ max: 5_000 });

/** Test seam: drop every cached verdict. */
export function resetLicenseVerdicts(): void {
  verdicts.clear();
}

/**
 * Verify a license against Gumroad. Returns the buyer email on success so
 * the caller can provision the student. Never throws on API shape drift —
 * anything unexpected is a rejection. Never logs the key.
 */
export async function verifyGumroadLicense(
  productId: string,
  licenseKey: string,
): Promise<LicenseCheck> {
  // The endpoint answers cleanly without auth (verified by probe), so the
  // token rides along only when configured — a missing token must not turn
  // verifiable licenses into rejections.
  const cacheKey = `${productId}:${licenseKey.trim()}`;
  const cached = verdicts.get(cacheKey);
  if (cached) return cached;
  const token = process.env.GUMROAD_ACCESS_TOKEN?.trim();
  try {
    const body = new URLSearchParams({ product_id: productId, license_key: licenseKey });
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return remember({ ok: false });
    const data = (await res.json()) as {
      success?: boolean;
      purchase?: { email?: string };
      email?: string;
    };
    if (data.success !== true) return remember({ ok: false });
    const email =
      (typeof data.purchase?.email === "string" && data.purchase.email) ||
      (typeof data.email === "string" && data.email) ||
      "";
    if (!email.includes("@")) return remember({ ok: false });
    return remember({ ok: true, email: email.trim().toLowerCase() });
  } catch {
    return remember({ ok: false });
  }

  function remember(verdict: LicenseCheck): LicenseCheck {
    verdicts.set(cacheKey, verdict, {
      ttl: verdict.ok ? OK_TTL_MS : REFUSED_TTL_MS,
    });
    return verdict;
  }
}

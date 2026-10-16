const VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

export type LicenseCheck = { ok: true; email: string } | { ok: false };

/**
 * Verify a license against Gumroad. Returns the buyer email on success so
 * the caller can provision the student. Never throws on API shape drift —
 * anything unexpected is a rejection. Never logs the key.
 */
export async function verifyGumroadLicense(
  productId: string,
  licenseKey: string,
): Promise<LicenseCheck> {
  const token = process.env.GUMROAD_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false };
  try {
    const body = new URLSearchParams({ product_id: productId, license_key: licenseKey });
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as {
      success?: boolean;
      purchase?: { email?: string };
      email?: string;
    };
    if (data.success !== true) return { ok: false };
    const email =
      (typeof data.purchase?.email === "string" && data.purchase.email) ||
      (typeof data.email === "string" && data.email) ||
      "";
    if (!email.includes("@")) return { ok: false };
    return { ok: true, email: email.trim().toLowerCase() };
  } catch {
    return { ok: false };
  }
}

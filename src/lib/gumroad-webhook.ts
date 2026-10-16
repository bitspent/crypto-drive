import { timingSafeEqual } from "crypto";
import type { TierId } from "./content";
import { sendLicenseEmail } from "./email";
import { generateLicenseKey, type LicenseTier } from "./license";
import { provisionLicensedStudent, recordWebhookEvent } from "./store";

export type PingSale = {
  saleId: string;
  email: string;
  productRef: string;
  price?: string;
  currency?: string;
};

export type PingOutcome =
  | {
      handled: true;
      duplicate: boolean;
      tier?: TierId;
      email?: string;
      licenseKey?: string;
    }
  | { handled: false; reason: "not-a-sale" | "unknown-product" | "missing-fields" };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Gumroad Ping carries no HMAC (plain form POST), so authenticity rests on
 * the shared secret embedded in the registered Ping URL (?secret=...) —
 * accepted here as the query param or, defensively, the X-Gumroad-Signature
 * header. Fail closed when the secret is unconfigured.
 */
export function verifyWebhookSecret(params: {
  querySecret: string | null;
  headerSignature: string | null;
}): boolean {
  const expected = process.env.GUMROAD_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  if (params.querySecret && safeEqual(params.querySecret, expected)) return true;
  if (params.headerSignature && safeEqual(params.headerSignature, expected)) return true;
  return false;
}

/** Parse the form-encoded Ping body. Returns null when it isn't a sale. */
export function parsePingForm(form: URLSearchParams): PingSale | null {
  if ((form.get("resource_name") ?? "sale") !== "sale") return null;
  const saleId = form.get("sale_id") ?? form.get("id") ?? "";
  const email = form.get("email") ?? "";
  const productRef = form.get("product_id") ?? form.get("product_permalink") ?? "";
  if (!saleId.trim() || !email.includes("@") || !productRef.trim()) return null;
  return {
    saleId: saleId.trim(),
    email: email.trim().toLowerCase(),
    productRef: productRef.trim(),
    price: form.get("price") ?? undefined,
    currency: form.get("currency") ?? undefined,
  };
}

/** Env product IDs (or permalinks) → tier. Unknown refs return null. */
export function tierForProductRef(ref: string): TierId | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const table: [string | undefined, TierId][] = [
    [process.env.GUMROAD_PRODUCT_STARTER?.trim(), "starter"],
    [process.env.GUMROAD_PRODUCT_CERTIFIED?.trim(), "certified"],
    [process.env.GUMROAD_PRODUCT_VIP?.trim(), "vip"],
  ];
  for (const [id, tier] of table) {
    if (id && id === trimmed) return tier;
  }
  return null;
}

function logWebhook(event: string, detail: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, source: "gumroad", ...detail }));
}

/**
 * Process one authenticated sale ping: idempotent provision + welcome email.
 * Never throws for business outcomes (duplicates, unknown products) — the
 * route always acks those with 200 so Gumroad stops retrying.
 */
export async function processGumroadSale(sale: PingSale): Promise<PingOutcome> {
  const tier = tierForProductRef(sale.productRef);
  if (!tier) {
    logWebhook("webhook.unknown_product", {
      saleId: sale.saleId,
      productRef: sale.productRef,
    });
    return { handled: false, reason: "unknown-product" };
  }
  const duplicate = await recordWebhookEvent("gumroad", sale.saleId, {
    email: sale.email,
    productRef: sale.productRef,
    price: sale.price,
    currency: sale.currency,
  });
  if (duplicate) {
    logWebhook("webhook.duplicate", { saleId: sale.saleId });
    return { handled: true, duplicate: true };
  }
  const licenseKey = generateLicenseKey(tier as LicenseTier);
  await provisionLicensedStudent(sale.email, tier, licenseKey);
  logWebhook("webhook.provisioned", { saleId: sale.saleId, tier });
  try {
    await sendLicenseEmail(sale.email, licenseKey, tier);
  } catch (e) {
    // The student is provisioned; a failed email must not fail the ping.
    // The key stays recoverable via unlock + Gumroad receipt.
    logWebhook("webhook.email_failed", {
      saleId: sale.saleId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return { handled: true, duplicate: false, tier, email: sale.email, licenseKey };
}

import { NextResponse } from "next/server";
import {
  parsePingForm,
  parsePingRefund,
  processGumroadRefund,
  processGumroadSale,
  verifyWebhookSecret,
} from "@/lib/gumroad-webhook";
import {
  checkRateLimit,
  isLocalDevRequest,
  RATE_LIMITS,
  rateLimitedResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

/**
 * Gumroad Ping receiver. Register with the secret in the URL:
 * https://<domain>/api/webhooks/gumroad?secret=<GUMROAD_WEBHOOK_SECRET>
 * Authenticated pings always ack 200 (even duplicates and unknown products)
 * so Gumroad stops retrying; only bad auth returns 401.
 */
export async function POST(request: Request) {
  try {
    // Limit before auth: the check is cheap and unauthenticated floods are
    // the threat. Gumroad retries real deliveries, so a 429 never loses a sale.
    if (!isLocalDevRequest(request)) {
      const result = checkRateLimit({
        key: `webhook:${getClientIp(request)}`,
        ...RATE_LIMITS.webhook,
      });
      if (!result.allowed) return rateLimitedResponse(result.retryAfter);
    }
    const url = new URL(request.url);
    const authed = verifyWebhookSecret({
      querySecret: url.searchParams.get("secret"),
      headerSignature: request.headers.get("X-Gumroad-Signature"),
    });
    if (!authed) {
      console.log(JSON.stringify({ event: "webhook.auth_failed", source: "gumroad" }));
      return NextResponse.json({ error: "forbidden" }, { status: 401 });
    }
    const raw = await request.text();
    const form = new URLSearchParams(raw);
    // Revocation first: a refunded sale still carries sale fields, so the
    // sale parser would ack it as a duplicate without revoking anyone.
    const refund = parsePingRefund(form);
    if (refund) {
      await processGumroadRefund(refund);
      return NextResponse.json({ ok: true });
    }
    const sale = parsePingForm(form);
    if (!sale) {
      console.log(JSON.stringify({ event: "webhook.ignored", source: "gumroad" }));
      return NextResponse.json({ ok: true });
    }
    const outcome = await processGumroadSale(sale);
    if (!outcome.handled) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true, duplicate: outcome.duplicate });
  } catch (e) {
    // Never fail a delivery on unexpected errors — log and ack.
    console.log(
      JSON.stringify({
        event: "webhook.error",
        source: "gumroad",
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return NextResponse.json({ ok: true });
  }
}

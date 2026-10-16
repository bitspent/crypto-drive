import { NextResponse } from "next/server";
import {
  parsePingForm,
  processGumroadSale,
  verifyWebhookSecret,
} from "@/lib/gumroad-webhook";

/**
 * Gumroad Ping receiver. Register with the secret in the URL:
 * https://<domain>/api/webhooks/gumroad?secret=<GUMROAD_WEBHOOK_SECRET>
 * Authenticated pings always ack 200 (even duplicates and unknown products)
 * so Gumroad stops retrying; only bad auth returns 401.
 */
export async function POST(request: Request) {
  try {
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
    const sale = parsePingForm(new URLSearchParams(raw));
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

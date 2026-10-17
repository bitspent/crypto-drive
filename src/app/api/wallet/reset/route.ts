import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { clearWalletForSession, getSessionAccess } from "@/lib/store";
import {
  checkRateLimit,
  isAdminRequest,
  isLocalDevRequest,
  RATE_LIMITS,
  rateLimitedResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Destructive reset: requires the typed word RESET, then clears the wallet. */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!isAdminRequest(req) && !isLocalDevRequest(req)) {
      const limited = checkRateLimit({
        key: `wallet:${sessionId ?? getClientIp(req)}`,
        ...RATE_LIMITS.wallet,
      });
      if (!limited.allowed) return rateLimitedResponse(limited.retryAfter);
    }
    const access = await getSessionAccess(sessionId ?? undefined);
    if (access.status === "revoked") {
      await clearSessionId();
      return err("Access revoked.", 403);
    }
    if (access.status === "none") return err("Unlock with your license before you continue.", 401);
    const body = (await req.json()) as { confirm?: unknown };
    if (body.confirm !== "RESET") return err("Type RESET to confirm.", 400);
    await clearWalletForSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not reset.", 400);
  }
}

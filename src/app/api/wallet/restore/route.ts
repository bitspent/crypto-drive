import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess } from "@/lib/store";
import {
  checkRateLimit,
  isAdminRequest,
  isLocalDevRequest,
  RATE_LIMITS,
  rateLimitedResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { restoreMatches } from "@/lib/wallet";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Compare entered words against the saved seed. Never mutates: a match means
 * the same wallet, a mismatch leaves everything untouched.
 */
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
    const student = access.student;
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet) return err("Create your wallet first.", 400);
    const body = (await req.json()) as { words?: unknown };
    if (!Array.isArray(body.words) || body.words.some((w) => typeof w !== "string")) {
      return err("Enter all 12 words.", 400);
    }
    return NextResponse.json({ match: restoreMatches(wallet.seedWords, body.words) });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not check words.", 400);
  }
}

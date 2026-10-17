import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import {
  createWalletForSession,
  getSessionAccess,
  getWalletForSession,
} from "@/lib/store";
import {
  checkRateLimit,
  isAdminRequest,
  isLocalDevRequest,
  RATE_LIMITS,
  rateLimitedResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { providerFailure } from "@/lib/bitcoin";

export async function GET() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const access = await getSessionAccess(sessionId ?? undefined);
  if (access.status === "revoked") {
    await clearSessionId();
    return NextResponse.json({ error: "Access revoked." }, { status: 403 });
  }
  const wallet = await getWalletForSession(sessionId ?? undefined);
  return NextResponse.json({ wallet });
}

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
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unlock with your license before you continue." },
        { status: 401 },
      );
    }
    const access = await getSessionAccess(sessionId);
    if (access.status === "revoked") {
      await clearSessionId();
      return NextResponse.json({ error: "Access revoked." }, { status: 403 });
    }
    const wallet = await createWalletForSession(sessionId);
    return NextResponse.json({ wallet });
  } catch (err) {
    // Regtest selected but infra missing/unreachable: the 503 offline message.
    const { message, status } = providerFailure(err, "Could not create wallet.");
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess, issueCertificate } from "@/lib/store";
import {
  checkRateLimit,
  isLocalDevRequest,
  RATE_LIMITS,
  rateLimitedResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!isLocalDevRequest(request)) {
      const result = checkRateLimit({
        key: `complete:${sessionId ?? getClientIp(request)}`,
        ...RATE_LIMITS.complete,
      });
      if (!result.allowed) return rateLimitedResponse(result.retryAfter);
    }
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unlock with your license before certifying." },
        { status: 401 },
      );
    }
    const access = await getSessionAccess(sessionId);
    if (access.status === "revoked") {
      await clearSessionId();
      return NextResponse.json({ error: "Access revoked." }, { status: 403 });
    }
    if (access.status === "none") {
      return NextResponse.json(
        { error: "Unlock with your license before certifying." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      studentName?: string;
      moduleSlug?: string;
    };
    const certificate = await issueCertificate({
      sessionId,
      studentName: body.studentName ?? "",
      moduleSlug: body.moduleSlug ?? "btc-explorer",
    });

    return NextResponse.json({ ok: true, id: certificate.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not issue certificate.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { StepAnswer } from "@/lib/practice-types";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess, passStep } from "@/lib/store";
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
        key: `progress:${sessionId ?? getClientIp(request)}`,
        ...RATE_LIMITS.progress,
      });
      if (!result.allowed) return rateLimitedResponse(result.retryAfter);
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
    if (access.status === "none") {
      return NextResponse.json(
        { error: "Unlock with your license before you continue." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      stepId?: string;
      answer?: StepAnswer;
    };
    const stepId = body.stepId?.trim() ?? "";
    if (!stepId) {
      return NextResponse.json({ error: "Missing step." }, { status: 400 });
    }

    await passStep(sessionId, stepId, body.answer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save progress.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

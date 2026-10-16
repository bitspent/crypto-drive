import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { StepAnswer } from "@/lib/practice-types";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess, passStep } from "@/lib/store";
import {
  checkRateLimit,
  clientIp,
  isAdminBypass,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!isAdminBypass(request)) {
      const verdict = checkRateLimit("progress", sessionId ?? clientIp(request));
      if (!verdict.ok) return rateLimitedResponse(verdict.retryAfter);
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

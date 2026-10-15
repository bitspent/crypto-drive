import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { StepAnswer } from "@/lib/practice-types";
import { SESSION_COOKIE } from "@/lib/session";
import { passStep } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
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

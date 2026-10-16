import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession } from "@/lib/store";
import { getActiveFeeTiers } from "@/lib/bitcoin";

/** Fee tiers for the send form, resolved from the active backend. */
export async function GET() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const student = await getStudentBySession(sessionId ?? undefined);
  if (!student) {
    return NextResponse.json(
      { error: "Unlock with your license before you continue." },
      { status: 401 },
    );
  }
  const tiers = await getActiveFeeTiers();
  return NextResponse.json({ tiers });
}

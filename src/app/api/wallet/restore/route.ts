import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession } from "@/lib/store";
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
    const student = await getStudentBySession(sessionId ?? undefined);
    if (!student) return err("Unlock with your license before you continue.", 401);
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

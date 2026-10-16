import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession, saveWalletForSession } from "@/lib/store";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Record that the learner backed up: stamp backupAt after reveal + recall. */
export async function POST() {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    const student = await getStudentBySession(sessionId ?? undefined);
    if (!student) return err("Unlock with your license before you continue.", 401);
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet) return err("Create your wallet first.", 400);
    const next = { ...wallet, backupAt: new Date().toISOString() };
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({ wallet: next });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not record backup.", 400);
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess, saveWalletForSession } from "@/lib/store";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Record that the learner backed up: stamp backupAt after reveal + recall. */
export async function POST() {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    const access = await getSessionAccess(sessionId ?? undefined);
    if (access.status === "revoked") {
      await clearSessionId();
      return err("Access revoked.", 403);
    }
    if (access.status === "none") return err("Unlock with your license before you continue.", 401);
    const student = access.student;
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet) return err("Create your wallet first.", 400);
    const next = { ...wallet, backupAt: new Date().toISOString() };
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({ wallet: next });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not record backup.", 400);
  }
}

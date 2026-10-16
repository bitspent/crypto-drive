import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { clearWalletForSession, getSessionAccess } from "@/lib/store";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Destructive reset: requires the typed word RESET, then clears the wallet. */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    const access = await getSessionAccess(sessionId ?? undefined);
    if (access.status === "revoked") {
      await clearSessionId();
      return err("Access revoked.", 403);
    }
    if (access.status === "none") return err("Unlock with your license before you continue.", 401);
    const body = (await req.json()) as { confirm?: unknown };
    if (body.confirm !== "RESET") return err("Type RESET to confirm.", 400);
    await clearWalletForSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not reset.", 400);
  }
}

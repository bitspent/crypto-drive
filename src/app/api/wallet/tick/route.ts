import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession, saveWalletForSession } from "@/lib/store";
import { advanceTx } from "@/lib/wallet";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Advance one confirmation onto a pending tx. Confirms at the threshold. */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    const student = await getStudentBySession(sessionId ?? undefined);
    if (!student) return err("Unlock with your license before you continue.", 401);
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet) return err("Create your wallet first.", 400);
    const body = (await req.json().catch(() => ({}))) as { txid?: string };
    if (typeof body.txid !== "string" || !body.txid) return err("Missing txid.", 400);
    const { wallet: next, confirmed } = advanceTx(wallet, body.txid);
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({
      tx: next.history.find((t) => t.id === body.txid) ?? null,
      wallet: next,
      confirmed,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not advance.", 400);
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess, saveWalletForSession } from "@/lib/store";
import { advanceTx, applyTxStatus } from "@/lib/wallet";
import { getBitcoinProvider, providerFailure } from "@/lib/bitcoin";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Regtest mode polls the real tx status; every other mode advances one
 * simulated confirmation (unchanged behavior). Confirms at the threshold.
 */
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
    const student = access.student;
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet) return err("Create your wallet first.", 400);
    const body = (await req.json().catch(() => ({}))) as { txid?: string };
    if (typeof body.txid !== "string" || !body.txid) return err("Missing txid.", 400);
    const provider = getBitcoinProvider();
    if (provider.network === "regtest") {
      let status: { confirmations: number };
      try {
        status = await provider.getTxStatus(body.txid);
      } catch (e) {
        if (e instanceof Error && e.message === "tx not found") return err(e.message, 404);
        const { message, status: code } = providerFailure(e, "Could not advance.");
        return err(message, code);
      }
      const { wallet: next, confirmed } = applyTxStatus(wallet, body.txid, status);
      await saveWalletForSession(sessionId, next);
      return NextResponse.json({
        tx: next.history.find((t) => t.id === body.txid) ?? null,
        wallet: next,
        confirmed,
      });
    }
    const { wallet: next, confirmed } = advanceTx(wallet, body.txid);
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({
      tx: next.history.find((t) => t.id === body.txid) ?? null,
      wallet: next,
      confirmed,
    });
  } catch (e) {
    const { message, status } = providerFailure(e, "Could not advance.");
    return err(message, status);
  }
}

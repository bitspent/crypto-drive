import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession, saveWalletForSession } from "@/lib/store";
import {
  applySend,
  validateSend,
  type FeeTierId,
} from "@/lib/wallet";
import { walletTxid } from "@/lib/practice-samples";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const TIERS = new Set(["economy", "standard", "priority"]);

/** Simulate an outgoing payment: validate, debit amount + fee, prepend pending tx. */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    const student = await getStudentBySession(sessionId ?? undefined);
    if (!student) return err("Unlock with your license before you continue.", 401);
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet || !student.practiceSeed) return err("Create your wallet first.", 400);
    const body = (await req.json()) as {
      to?: unknown;
      amountSats?: unknown;
      feeTier?: unknown;
      memo?: unknown;
    };
    if (typeof body.to !== "string") return err("Enter a recipient address.", 400);
    if (typeof body.amountSats !== "number") return err("Enter an amount.", 400);
    if (typeof body.feeTier !== "string" || !TIERS.has(body.feeTier)) {
      return err("Pick a fee tier.", 400);
    }
    const verdict = validateSend(wallet, {
      to: body.to,
      amountSats: body.amountSats,
      feeTier: body.feeTier as FeeTierId,
    });
    if (verdict) return err(verdict, 400);
    const next = applySend(wallet, {
      txid: walletTxid(student.practiceSeed, wallet.history.length),
      to: body.to,
      amountSats: body.amountSats,
      feeTier: body.feeTier as FeeTierId,
      timestamp: new Date().toISOString(),
      ...(typeof body.memo === "string" ? { memo: body.memo } : {}),
    });
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({ tx: next.history[0], wallet: next });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not send.", 400);
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession, saveWalletForSession } from "@/lib/store";
import {
  applySend,
  feeSatsForTier,
  validateSend,
  type FeeTierId,
} from "@/lib/wallet";
import { getActiveFeeTiers } from "@/lib/bitcoin";
import { walletTxid } from "@/lib/practice-samples";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const TIERS = new Set(["economy", "standard", "priority"]);

/**
 * Record an outgoing payment: validate, debit amount + fee, prepend pending tx.
 * Sends are recorded, never broadcast — the app holds no keys — in every mode.
 * The fee comes from the active backend's tiers (simulated: today's values).
 */
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
    const feeTier = body.feeTier as FeeTierId;
    const tiers = await getActiveFeeTiers();
    const feeSats = feeSatsForTier(feeTier, tiers);
    const verdict = validateSend(wallet, {
      to: body.to,
      amountSats: body.amountSats,
      feeTier,
      feeSats,
    });
    if (verdict) return err(verdict, 400);
    const next = applySend(wallet, {
      txid: walletTxid(student.practiceSeed, wallet.history.length),
      to: body.to,
      amountSats: body.amountSats,
      feeTier,
      timestamp: new Date().toISOString(),
      ...(typeof body.memo === "string" ? { memo: body.memo } : {}),
      feeSats,
    });
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({ tx: next.history[0], wallet: next });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not send.", 400);
  }
}

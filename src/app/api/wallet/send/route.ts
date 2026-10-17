import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess, saveWalletForSession } from "@/lib/store";
import {
  checkRateLimit,
  isAdminRequest,
  isLocalDevRequest,
  RATE_LIMITS,
  rateLimitedResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
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
    if (!isAdminRequest(req) && !isLocalDevRequest(req)) {
      const limited = checkRateLimit({
        key: `wallet:${sessionId ?? getClientIp(req)}`,
        ...RATE_LIMITS.wallet,
      });
      if (!limited.allowed) return rateLimitedResponse(limited.retryAfter);
    }
    const access = await getSessionAccess(sessionId ?? undefined);
    if (access.status === "revoked") {
      await clearSessionId();
      return err("Access revoked.", 403);
    }
    if (access.status === "none") return err("Unlock with your license before you continue.", 401);
    const student = access.student;
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

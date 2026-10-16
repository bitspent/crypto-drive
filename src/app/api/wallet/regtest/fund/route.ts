import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession, saveWalletForSession } from "@/lib/store";
import { applyDeposit, WALLET_DEPOSIT_SATS } from "@/lib/wallet";
import { getBitcoinProvider, providerFailure } from "@/lib/bitcoin";

const MAX_FUND_SATS = 1_000_000;
const FUND_COOLDOWN_MS = 60_000;

/** MVP session throttle. Prompt 5 replaces this with route-wide rate limits. */
const lastFundAt = new Map<string, number>();

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Regtest only (404 otherwise): fund the wallet address from the infra
 * faucet. One call per session per 60s. Test/enterprise hook.
 */
export async function POST(req: Request) {
  let provider;
  try {
    provider = getBitcoinProvider();
  } catch (e) {
    const { message, status } = providerFailure(e, "Could not fund.");
    return err(message, status);
  }
  if (provider.network !== "regtest") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    const student = await getStudentBySession(sessionId ?? undefined);
    if (!student) return err("Unlock with your license before you continue.", 401);
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet) return err("Create your wallet first.", 400);
    const body = (await req.json().catch(() => ({}))) as { amountSats?: unknown };
    const amountSats =
      body.amountSats === undefined ? WALLET_DEPOSIT_SATS : body.amountSats;
    if (
      typeof amountSats !== "number" ||
      !Number.isSafeInteger(amountSats) ||
      amountSats <= 0 ||
      amountSats > MAX_FUND_SATS
    ) {
      return err("Amount out of range.", 400);
    }
    if (sessionId) {
      const last = lastFundAt.get(sessionId) ?? 0;
      if (Date.now() - last < FUND_COOLDOWN_MS) {
        return err("One funding per minute. Try again shortly.", 429);
      }
      lastFundAt.set(sessionId, Date.now());
    }
    let txid: string;
    try {
      ({ txid } = await provider.fundAddress(wallet.address, amountSats));
    } catch (e) {
      const { message, status } = providerFailure(e, "Could not fund.");
      return err(message, status);
    }
    const next = applyDeposit(wallet, {
      txid,
      from: "regtest faucet",
      amountSats,
      timestamp: new Date().toISOString(),
    });
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({ tx: next.history[0], wallet: next });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not fund.", 400);
  }
}

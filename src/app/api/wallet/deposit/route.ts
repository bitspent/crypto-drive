import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getStudentBySession, saveWalletForSession } from "@/lib/store";
import { applyDeposit, WALLET_DEPOSIT_SATS } from "@/lib/wallet";
import { getBitcoinProvider, providerFailure } from "@/lib/bitcoin";
import { walletCounterparty, walletTxid } from "@/lib/practice-samples";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Incoming payment: regtest mode funds the wallet address from the infra
 * faucet; every other mode simulates a fixed deposit (unchanged behavior).
 */
export async function POST() {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    const student = await getStudentBySession(sessionId ?? undefined);
    if (!student) return err("Unlock with your license before you continue.", 401);
    const wallet = student.wallet?.exists ? student.wallet : null;
    if (!wallet || !student.practiceSeed) return err("Create your wallet first.", 400);
    const provider = getBitcoinProvider();
    if (provider.network === "regtest") {
      let txid: string;
      try {
        ({ txid } = await provider.fundAddress(wallet.address, WALLET_DEPOSIT_SATS));
      } catch (e) {
        const { message, status } = providerFailure(e, "Could not receive.");
        return err(message, status);
      }
      const next = applyDeposit(wallet, {
        txid,
        from: "regtest faucet",
        amountSats: WALLET_DEPOSIT_SATS,
        timestamp: new Date().toISOString(),
      });
      await saveWalletForSession(sessionId, next);
      return NextResponse.json({ tx: next.history[0], wallet: next });
    }
    const n = wallet.history.length;
    const next = applyDeposit(wallet, {
      txid: walletTxid(student.practiceSeed, n),
      from: walletCounterparty(student.practiceSeed, n),
      amountSats: WALLET_DEPOSIT_SATS,
      timestamp: new Date().toISOString(),
    });
    await saveWalletForSession(sessionId, next);
    return NextResponse.json({ tx: next.history[0], wallet: next });
  } catch (e) {
    const { message, status } = providerFailure(e, "Could not receive.");
    return err(message, status);
  }
}

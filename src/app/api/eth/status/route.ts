import { NextResponse } from "next/server";
import { ethFailure, getEthProvider } from "@/lib/eth";

/**
 * Spike consumer for the ETH backends: proves app → provider → (infra-api →
 * Anvil) with a status read. Public like /api/health — status only, no
 * secrets, no mutations. Faucet/mine stay server-side provider methods with
 * no app routes until an ETH wallet needs them.
 */
export async function GET() {
  try {
    const provider = getEthProvider();
    const fees = await provider.getFees();
    return NextResponse.json({ mode: provider.network, ok: true, fees });
  } catch (e) {
    const { message, status } = ethFailure(e, "Could not read Ethereum fees.");
    return NextResponse.json({ error: message }, { status });
  }
}

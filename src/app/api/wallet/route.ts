import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { createWalletForSession, getWalletForSession } from "@/lib/store";
import { providerFailure } from "@/lib/bitcoin";

export async function GET() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const wallet = await getWalletForSession(sessionId ?? undefined);
  return NextResponse.json({ wallet });
}

export async function POST() {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unlock with your license before you continue." },
        { status: 401 },
      );
    }
    const wallet = await createWalletForSession(sessionId);
    return NextResponse.json({ wallet });
  } catch (err) {
    // Regtest selected but infra missing/unreachable: the 503 offline message.
    const { message, status } = providerFailure(err, "Could not create wallet.");
    return NextResponse.json({ error: message }, { status });
  }
}

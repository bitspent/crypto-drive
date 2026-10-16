import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import {
  createWalletForSession,
  getSessionAccess,
  getWalletForSession,
} from "@/lib/store";
import { providerFailure } from "@/lib/bitcoin";

export async function GET() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const access = await getSessionAccess(sessionId ?? undefined);
  if (access.status === "revoked") {
    await clearSessionId();
    return NextResponse.json({ error: "Access revoked." }, { status: 403 });
  }
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
    const access = await getSessionAccess(sessionId);
    if (access.status === "revoked") {
      await clearSessionId();
      return NextResponse.json({ error: "Access revoked." }, { status: 403 });
    }
    const wallet = await createWalletForSession(sessionId);
    return NextResponse.json({ wallet });
  } catch (err) {
    // Regtest selected but infra missing/unreachable: the 503 offline message.
    const { message, status } = providerFailure(err, "Could not create wallet.");
    return NextResponse.json({ error: message }, { status });
  }
}

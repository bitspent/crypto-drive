import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionId, SESSION_COOKIE } from "@/lib/session";
import { getSessionAccess } from "@/lib/store";
import { getActiveFeeTiers } from "@/lib/bitcoin";

/** Fee tiers for the send form, resolved from the active backend. */
export async function GET() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const access = await getSessionAccess(sessionId ?? undefined);
  if (access.status === "revoked") {
    await clearSessionId();
    return NextResponse.json({ error: "Access revoked." }, { status: 403 });
  }
  if (access.status === "none") {
    return NextResponse.json(
      { error: "Unlock with your license before you continue." },
      { status: 401 },
    );
  }
  const tiers = await getActiveFeeTiers();
  return NextResponse.json({ tiers });
}

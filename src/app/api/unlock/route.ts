import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { isValidLicense, REVOKED_ERROR, unlockStudent } from "@/lib/store";
import { resolveLicenseKind } from "@/lib/license";
import { unlockWithLicense } from "@/lib/unlock";
import {
  checkRateLimit,
  isLocalDevRequest,
  RATE_LIMITS,
  rateLimitedResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

function sessioned(tier: string, sessionId: string) {
  const response = NextResponse.json({ ok: true, tier });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      license?: string;
    };

    const email = body.email?.trim() ?? "";
    const license = body.license?.trim() ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const kind = resolveLicenseKind(license);

    // Demo keys are exempt (dev and test harnesses only), as is localhost
    // in dev. Everything else counts, valid or not.
    if (kind !== "demo" && !isLocalDevRequest(request)) {
      const result = checkRateLimit({
        key: `unlock:${getClientIp(request)}`,
        ...RATE_LIMITS.unlock,
      });
      if (!result.allowed) return rateLimitedResponse(result.retryAfter);
    }

    if (kind === "demo-blocked") {
      return NextResponse.json(
        { error: "Demo keys are disabled in production." },
        { status: 401 },
      );
    }

    if (kind === "licensed") {
      const result = await unlockWithLicense(license);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      return sessioned(result.tier, result.sessionId);
    }

    if (kind === "demo") {
      if (!(await isValidLicense(license))) {
        return NextResponse.json(
          {
            error:
              "That license key didn’t unlock. Check your Gumroad receipt or demo key.",
          },
          { status: 401 },
        );
      }
      try {
        const { sessionId, tier } = await unlockStudent(email, license);
        return sessioned(tier, sessionId);
      } catch (e) {
        if (e instanceof Error && e.message === REVOKED_ERROR) {
          return NextResponse.json({ error: REVOKED_ERROR }, { status: 401 });
        }
        throw e;
      }
    }

    return NextResponse.json(
      {
        error:
          "That license key didn’t unlock. Check your Gumroad receipt or demo key.",
      },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { error: "Unlock failed. Try again in a moment." },
      { status: 500 },
    );
  }
}

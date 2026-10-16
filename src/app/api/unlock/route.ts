import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import {
  createSessionForStudent,
  findStudentByLicenseKey,
  isValidLicense,
  provisionLicensedStudent,
  unlockStudent,
  type Student,
} from "@/lib/store";
import { resolveLicenseKind, tierFromLicenseKey } from "@/lib/license";
import { verifyGumroadLicense } from "@/lib/gumroad";

function productIdForTier(tier: "starter" | "certified" | "vip"): string | null {
  const table = {
    starter: process.env.GUMROAD_PRODUCT_STARTER?.trim(),
    certified: process.env.GUMROAD_PRODUCT_CERTIFIED?.trim(),
    vip: process.env.GUMROAD_PRODUCT_VIP?.trim(),
  } as const;
  return table[tier] || null;
}

function sessioned(tier: string, sessionId: string) {
  const response = NextResponse.json({ ok: true, tier });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
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

    if (kind === "demo-blocked") {
      return NextResponse.json(
        { error: "Demo keys are disabled in production." },
        { status: 401 },
      );
    }

    if (kind === "licensed") {
      const tier = tierFromLicenseKey(license);
      if (!tier) {
        return NextResponse.json({ error: "License not recognized." }, { status: 401 });
      }
      const known: Student | null = await findStudentByLicenseKey(license);
      if (known) {
        const sessionId = await createSessionForStudent(known.id);
        return sessioned(known.tier, sessionId);
      }
      // Unknown key: ask Gumroad before rejecting.
      const productId = productIdForTier(tier);
      if (productId) {
        const check = await verifyGumroadLicense(productId, license);
        if (check.ok) {
          const created = await provisionLicensedStudent(check.email, tier, license);
          const sessionId = await createSessionForStudent(created.id);
          return sessioned(created.tier, sessionId);
        }
      }
      return NextResponse.json({ error: "License not recognized." }, { status: 401 });
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
      const { sessionId, tier } = await unlockStudent(email, license);
      return sessioned(tier, sessionId);
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

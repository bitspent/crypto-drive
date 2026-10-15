import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { isValidLicense, unlockStudent } from "@/lib/store";

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
    const response = NextResponse.json({ ok: true, tier });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unlock failed. Try again in a moment." },
      { status: 500 },
    );
  }
}

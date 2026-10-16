"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";
import { isValidLicense, unlockStudent } from "@/lib/store";
import { resolveLicenseKind } from "@/lib/license";
import {
  checkRateLimit,
  ipFromHeaders,
  isAdminToken,
} from "@/lib/rate-limit";

export type UnlockState = {
  error: string | null;
};

export async function unlockAction(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const email = String(formData.get("email") ?? "").trim();
  const license = String(formData.get("license") ?? "").trim();

  // Same 10-per-5-min budget as POST /api/unlock: the form is the unlock path
  // every learner actually uses. Demo keys (dev/test only) are exempt.
  const kind = resolveLicenseKind(license);
  const headerList = await headers();
  if (
    kind !== "demo" &&
    !isAdminToken(headerList.get("x-admin-token")) &&
    !checkRateLimit(
      "unlock",
      ipFromHeaders(
        headerList.get("x-forwarded-for"),
        headerList.get("x-real-ip"),
      ),
    ).ok
  ) {
    return { error: "Too many unlock attempts. Try again in a few minutes." };
  }

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  if (!(await isValidLicense(license))) {
    return {
      error:
        "That license key didn’t unlock. Check your Gumroad receipt for the exact key.",
    };
  }

  try {
    const { sessionId } = await unlockStudent(email, license);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    return { error: "Unlock failed. Try again in a moment." };
  }

  redirect("/course");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/unlock");
}

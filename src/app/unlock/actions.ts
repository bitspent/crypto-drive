"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";
import { isValidLicense, unlockStudent } from "@/lib/store";

export type UnlockState = {
  error: string | null;
};

export async function unlockAction(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const email = String(formData.get("email") ?? "").trim();
  const license = String(formData.get("license") ?? "").trim();

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

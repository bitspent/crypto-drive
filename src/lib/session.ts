import { cookies } from "next/headers";

export const SESSION_COOKIE = "cd_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function getSessionId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function setSessionId(sessionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionId(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

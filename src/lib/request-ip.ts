/**
 * Client identity for rate limiting. Reads X-Forwarded-For (Vercel sets it;
 * first entry wins) and falls back to "unknown" — App Router requests expose
 * no socket address. Never trust any other client-supplied IP input.
 */
export function ipFromHeaders(xForwardedFor: string | null): string {
  const first = xForwardedFor?.split(",")[0]?.trim();
  return first || "unknown";
}

export function getClientIp(req: Request): string {
  return ipFromHeaders(req.headers.get("x-forwarded-for"));
}

/** Loopback check for the dev-only localhost bypass. */
export function isLoopbackIp(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

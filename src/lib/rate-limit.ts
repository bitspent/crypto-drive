// In-memory fixed-window rate limits for the abuse-prone API surfaces.
//
// MVP store: one LRU per server process. On serverless each instance keeps its
// own buckets, so the caps below are approximate (N warm instances ≈ N× the
// nominal rate) — acceptable until abuse says otherwise. Migration path: swap
// the `hits` cache for Redis INCR + PTTL keyed identically
// (`rl:<bucket>:<identity>`), keeping checkRateLimit's signature and the 429
// contract unchanged; no route handler should need edits.
import { LRUCache } from "lru-cache";

export type RateBucket = "unlock" | "progress" | "complete" | "webhook";

export const RATE_LIMITS: Record<RateBucket, { windowMs: number; max: number }> = {
  unlock: { windowMs: 5 * 60 * 1000, max: 10 },
  progress: { windowMs: 5 * 60 * 1000, max: 60 },
  complete: { windowMs: 60 * 60 * 1000, max: 3 },
  webhook: { windowMs: 60 * 1000, max: 100 },
};

type Entry = { count: number; resetAt: number };

const hits = new LRUCache<string, Entry>({
  max: 5000,
  // Longest window; entries also reset on read via resetAt, so expiry here
  // only bounds memory. updateAgeOnGet stays false: windows are fixed, not
  // sliding.
  ttl: 60 * 60 * 1000,
});

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfter: number };

export function checkRateLimit(
  bucket: RateBucket,
  identity: string,
  override?: { windowMs: number; max: number },
): RateLimitVerdict {
  const { windowMs, max } = override ?? RATE_LIMITS[bucket];
  const now = Date.now();
  const key = `${bucket}:${identity}`;
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count < max) {
    entry.count += 1;
    hits.set(key, entry);
    return { ok: true };
  }
  return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

/** Test seam: clear every bucket. */
export function resetRateLimits(): void {
  hits.clear();
}

export function ipFromHeaders(
  xForwardedFor: string | null,
  xRealIp: string | null,
): string {
  const first = xForwardedFor?.split(",")[0]?.trim();
  if (first) return first;
  const real = xRealIp?.trim();
  if (real) return real;
  // App Router requests expose no socket address; headerless clients (local
  // dev, direct curl) share one bucket. Vercel always sets X-Forwarded-For.
  return "unknown";
}

export function clientIp(req: Request): string {
  return ipFromHeaders(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"));
}

export function isAdminToken(token: string | null | undefined): boolean {
  const expected = process.env.ADMIN_MINE_TOKEN?.trim();
  if (!expected) return false;
  return token?.trim() === expected;
}

export function isAdminBypass(req: Request): boolean {
  return isAdminToken(req.headers.get("x-admin-token"));
}

export function rateLimitedResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: "rate limited", retryAfter }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(retryAfter),
    },
  });
}

// In-memory fixed-window rate limits (MVP). One LRU per server process; on
// serverless the caps are approximate (N warm instances ≈ N× nominal).
// Migration path: Redis INCR + PTTL keyed identically, same signature.
import { LRUCache } from "lru-cache";
import { getClientIp, isLoopbackIp } from "./request-ip";

export type RateLimitConfig = {
  key: string; // "unlock:1.2.3.4" or "progress:<session-id>"
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds; 0 when allowed
};

export const RATE_LIMITS = {
  unlock: { limit: 10, windowMs: 5 * 60 * 1000 },
  progress: { limit: 60, windowMs: 5 * 60 * 1000 },
  complete: { limit: 3, windowMs: 60 * 60 * 1000 },
  webhook: { limit: 100, windowMs: 60 * 1000 },
  wallet: { limit: 60, windowMs: 60 * 1000 },
  faucet: { limit: 3, windowMs: 5 * 60 * 1000 },
} as const;

type Entry = { count: number; resetAt: number };

const hits = new LRUCache<string, Entry>({ max: 10_000 });

export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { key, limit, windowMs } = config;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs }, { ttl: windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (entry.count < limit) {
    entry.count += 1;
    hits.set(key, entry, { ttl: Math.max(1, entry.resetAt - now) });
    return { allowed: true, remaining: limit - entry.count, retryAfter: 0 };
  }
  return {
    allowed: false,
    remaining: 0,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/** Test seam: clear every bucket. */
export function resetRateLimits(): void {
  hits.clear();
}

/** X-Admin-Token bypass (wallet routes only). */
export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_MINE_TOKEN?.trim();
  if (!expected) return false;
  return req.headers.get("x-admin-token")?.trim() === expected;
}

export function isAdminToken(token: string | null | undefined): boolean {
  const expected = process.env.ADMIN_MINE_TOKEN?.trim();
  if (!expected) return false;
  return token?.trim() === expected;
}

/** Localhost in dev bypasses every limit (e2e runs production mode: unaffected). */
export function isLocalDevRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return isLoopbackIp(getClientIp(req));
}

export function rateLimitedResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: `Too many requests. Try again in ${retryAfter} seconds.` }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfter),
      },
    },
  );
}

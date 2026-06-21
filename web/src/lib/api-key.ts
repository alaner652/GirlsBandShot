import { LRUCache } from "lru-cache";
import { NextRequest } from "next/server";

function validKeys(): Set<string> {
  return new Set(
    (process.env.API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean)
  );
}

export function validateApiKey(req: NextRequest): { valid: boolean; key: string | null } {
  const key = req.headers.get("x-api-key");
  if (!key) return { valid: false, key: null };
  return { valid: validKeys().has(key), key };
}

// Per-key hourly counters
const hourly = new LRUCache<string, number>({ max: 10_000, ttl: 60 * 60 * 1_000 });

export function rateLimitV1(
  key: string,
  action: string,
  limit: number
): { ok: boolean; remaining: number } {
  const k = `${action}:${key}`;
  const count = (hourly.get(k) ?? 0) + 1;
  hourly.set(k, count);
  const remaining = Math.max(0, limit - count);
  return { ok: count <= limit, remaining };
}

export const V1_LIMITS = {
  search: 600,  // per hour per key
  image: 100,
  gif: 10,
} as const;

export type AuthResult =
  | { ok: true; remaining: number }
  | { ok: false; response: Response };

export function requireApiKey(req: NextRequest, resource: keyof typeof V1_LIMITS): AuthResult {
  const { valid, key } = validateApiKey(req);
  if (!valid) {
    return {
      ok: false,
      response: Response.json(
        { error: "Missing or invalid API key", hint: "Provide X-Api-Key header" },
        { status: 401 }
      ),
    };
  }
  const { ok, remaining } = rateLimitV1(key!, resource, V1_LIMITS[resource]);
  if (!ok) {
    return {
      ok: false,
      response: Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" } }
      ),
    };
  }
  return { ok: true, remaining };
}

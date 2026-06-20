import { LRUCache } from "lru-cache";

const counters = new LRUCache<string, number>({ max: 10000, ttl: 60_000 });

export function rateLimit(ip: string, limit: number): { ok: boolean; remaining: number } {
  const key = ip;
  const current = (counters.get(key) ?? 0) + 1;
  counters.set(key, current);
  return { ok: current <= limit, remaining: Math.max(0, limit - current) };
}

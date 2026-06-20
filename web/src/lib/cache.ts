import { LRUCache } from "lru-cache";

// Image / GIF buffers — 500 items, 1 hour TTL
export const mediaCache = new LRUCache<string, Buffer>({
  max: 500,
  ttl: 1000 * 60 * 60,
});

// Search results — 200 queries, 5 min TTL
export const searchCache = new LRUCache<string, object>({
  max: 200,
  ttl: 1000 * 60 * 5,
});

export function searchCacheKey(
  series: string,
  keyword: string,
  episode: string | null,
  page: number,
  limit: number
) {
  return `${series}|${keyword}|${episode ?? ""}|${page}|${limit}`;
}

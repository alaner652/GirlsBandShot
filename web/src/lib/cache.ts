import { LRUCache } from "lru-cache";

// Image / GIF buffers — 圖和 GIF 共用，所以用 bytes 而非筆數當上限：
// 500 個 GIF（每個 ~850 KB）就是 400+ MB，在小台 VM 上會吃光記憶體。
const MEDIA_CACHE_MB = Number(process.env.MEDIA_CACHE_MB ?? 256);

export const mediaCache = new LRUCache<string, Buffer>({
  max: 500,
  maxSize: MEDIA_CACHE_MB * 1024 * 1024,
  sizeCalculation: (buf) => buf.length,
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

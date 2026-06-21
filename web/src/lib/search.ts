import { getDb, listSeries, SubtitleRow } from "@/lib/db";
import { searchCache, searchCacheKey } from "@/lib/cache";

export interface SearchParams {
  series: string;
  keyword: string;
  episode: string | null;
  page: number;
  limit: number;
}

export interface SearchPayload {
  total: number;
  page: number;
  limit: number;
  results: {
    id: string;
    episode_id: string;
    timestamp: string;
    seconds: number;
    end_seconds: number | null;
    text: string;
    confidence: number;
    image_url: string;
    gif_url: string;
  }[];
}

export function validateSeries(series: string): { error: string; status: number } | null {
  const available = listSeries();
  if (!series || !available.includes(series)) {
    return available.length === 0
      ? { error: "no series available", status: 404 }
      : { error: "invalid series", status: 400 };
  }
  return null;
}

export function searchSubtitles(
  params: SearchParams,
  urlBase = "/api",
  cachePrefix = ""
): SearchPayload {
  const { series, keyword, episode, page, limit } = params;
  const offset = (page - 1) * limit;

  const key = `${cachePrefix}${searchCacheKey(series, keyword, episode, page, limit)}`;
  const cached = searchCache.get(key) as SearchPayload | undefined;
  if (cached) return cached;

  const db = getDb(series);
  const hasKeyword = keyword.trim().length > 0;

  const total = hasKeyword
    ? (db.prepare("SELECT COUNT(*) as cnt FROM subtitles WHERE text LIKE ? AND (episode_id = ? OR ? IS NULL)")
        .get(`%${keyword}%`, episode, episode) as { cnt: number }).cnt
    : (db.prepare("SELECT COUNT(*) as cnt FROM subtitles WHERE (episode_id = ? OR ? IS NULL)")
        .get(episode, episode) as { cnt: number }).cnt;

  const rows = hasKeyword
    ? (db.prepare("SELECT id, episode_id, timestamp, seconds, end_seconds, text, confidence FROM subtitles WHERE text LIKE ? AND (episode_id = ? OR ? IS NULL) ORDER BY episode_id, seconds LIMIT ? OFFSET ?")
        .all(`%${keyword}%`, episode, episode, limit, offset) as SubtitleRow[])
    : (db.prepare("SELECT id, episode_id, timestamp, seconds, end_seconds, text, confidence FROM subtitles WHERE (episode_id = ? OR ? IS NULL) ORDER BY episode_id, seconds LIMIT ? OFFSET ?")
        .all(episode, episode, limit, offset) as SubtitleRow[]);

  const results = rows.map((r) => ({
    id: r.id,
    episode_id: r.episode_id,
    timestamp: r.timestamp,
    seconds: r.seconds,
    end_seconds: r.end_seconds,
    text: r.text,
    confidence: r.confidence,
    image_url: `${urlBase}/image/${series}/${r.id}`,
    gif_url: `${urlBase}/gif/${series}/${r.id}`,
  }));

  const payload = { total, page, limit, results };
  searchCache.set(key, payload);
  return payload;
}

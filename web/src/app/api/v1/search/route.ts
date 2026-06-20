import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, rateLimitV1, V1_LIMITS } from "@/lib/api-key";
import { getDb, listSeries, SubtitleRow } from "@/lib/db";
import { searchCache, searchCacheKey } from "@/lib/cache";

type SearchPayload = { total: number; page: number; limit: number; results: object[] };

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { valid, key } = validateApiKey(req);
  if (!valid) {
    return NextResponse.json(
      { error: "Missing or invalid API key", hint: "Provide X-Api-Key header" },
      { status: 401 }
    );
  }

  const { ok, remaining } = rateLimitV1(key!, "search", V1_LIMITS.search);
  if (!ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, {
      status: 429,
      headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" },
    });
  }

  const { searchParams } = req.nextUrl;
  const keyword = searchParams.get("keyword") ?? "";
  const episode = searchParams.get("episode") ?? null;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  const available = listSeries();
  const series = searchParams.get("series") ?? available[0] ?? "";
  if (!series) {
    return NextResponse.json({ error: "no series available" }, { status: 404 });
  }

  const cacheKey = `v1:${searchCacheKey(series, keyword, episode, page, limit)}`;
  const cached = searchCache.get(cacheKey) as SearchPayload | undefined;
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=30",
        "X-Cache": "HIT",
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  }

  const db = getDb(series);
  const hasKeyword = keyword.trim().length > 0;

  const total = hasKeyword
    ? (db.prepare(
        `SELECT COUNT(*) as cnt FROM subtitles WHERE text LIKE ? AND (episode_id = ? OR ? IS NULL)`
      ).get(`%${keyword}%`, episode, episode) as { cnt: number }).cnt
    : (db.prepare(
        `SELECT COUNT(*) as cnt FROM subtitles WHERE (episode_id = ? OR ? IS NULL)`
      ).get(episode, episode) as { cnt: number }).cnt;

  const rows = hasKeyword
    ? (db.prepare(
        `SELECT id, episode_id, timestamp, seconds, end_seconds, text, confidence
         FROM subtitles
         WHERE text LIKE ? AND (episode_id = ? OR ? IS NULL)
         ORDER BY episode_id, seconds LIMIT ? OFFSET ?`
      ).all(`%${keyword}%`, episode, episode, limit, offset) as SubtitleRow[])
    : (db.prepare(
        `SELECT id, episode_id, timestamp, seconds, end_seconds, text, confidence
         FROM subtitles
         WHERE (episode_id = ? OR ? IS NULL)
         ORDER BY episode_id, seconds LIMIT ? OFFSET ?`
      ).all(episode, episode, limit, offset) as SubtitleRow[]);

  const results = rows.map((r) => ({
    id: r.id,
    episode_id: r.episode_id,
    timestamp: r.timestamp,
    seconds: r.seconds,
    end_seconds: r.end_seconds,
    text: r.text,
    confidence: r.confidence,
    image_url: `/api/v1/image/${series}/${r.id}`,
    gif_url: `/api/v1/gif/${series}/${r.id}`,
  }));

  const payload = { total, page, limit, results };
  searchCache.set(cacheKey, payload);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=30",
      "X-Cache": "MISS",
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}

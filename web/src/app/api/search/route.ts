import { NextRequest, NextResponse } from "next/server";
import { getDb, listSeries, SubtitleRow } from "@/lib/db";
import { searchCache, searchCacheKey } from "@/lib/cache";

type SearchPayload = { total: number; page: number; limit: number; results: object[] };

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

  const cacheKey = searchCacheKey(series, keyword, episode, page, limit);
  const cached = searchCache.get(cacheKey) as SearchPayload | undefined;
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=30", "X-Cache": "HIT" },
    });
  }

  const db = getDb(series);
  const hasKeyword = keyword.trim().length > 0;

  const total = hasKeyword
    ? (db
        .prepare(
          `SELECT COUNT(*) as cnt FROM subtitles
           WHERE text LIKE ? AND (episode_id = ? OR ? IS NULL)`
        )
        .get(`%${keyword}%`, episode, episode) as { cnt: number }).cnt
    : (db
        .prepare(
          `SELECT COUNT(*) as cnt FROM subtitles
           WHERE (episode_id = ? OR ? IS NULL)`
        )
        .get(episode, episode) as { cnt: number }).cnt;

  const rows = hasKeyword
    ? (db
        .prepare(
          `SELECT id, episode_id, timestamp, seconds, end_seconds, text, confidence, video_path
           FROM subtitles
           WHERE text LIKE ? AND (episode_id = ? OR ? IS NULL)
           ORDER BY episode_id, seconds LIMIT ? OFFSET ?`
        )
        .all(`%${keyword}%`, episode, episode, limit, offset) as SubtitleRow[])
    : (db
        .prepare(
          `SELECT id, episode_id, timestamp, seconds, end_seconds, text, confidence, video_path
           FROM subtitles
           WHERE (episode_id = ? OR ? IS NULL)
           ORDER BY episode_id, seconds LIMIT ? OFFSET ?`
        )
        .all(episode, episode, limit, offset) as SubtitleRow[]);

  const results = rows.map((r) => ({
    id: r.id,
    episode_id: r.episode_id,
    timestamp: r.timestamp,
    seconds: r.seconds,
    end_seconds: r.end_seconds,
    text: r.text,
    confidence: r.confidence,
    image_url: `/api/image/${series}/${r.id}`,
    gif_url: `/api/gif/${series}/${r.id}`,
  }));

  const payload = { total, page, limit, results };
  searchCache.set(cacheKey, payload);

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=30", "X-Cache": "MISS" },
  });
}

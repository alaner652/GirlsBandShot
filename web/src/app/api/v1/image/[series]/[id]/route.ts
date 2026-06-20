import { NextRequest } from "next/server";
import { validateApiKey, rateLimitV1, V1_LIMITS } from "@/lib/api-key";
import { getDb, SubtitleRow } from "@/lib/db";
import { extractFrame } from "@/lib/ffmpeg";
import { mediaCache } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const { valid, key } = validateApiKey(req);
  if (!valid) {
    return Response.json(
      { error: "Missing or invalid API key", hint: "Provide X-Api-Key header" },
      { status: 401 }
    );
  }

  const { ok, remaining } = rateLimitV1(key!, "image", V1_LIMITS.image);
  if (!ok) {
    return Response.json({ error: "Rate limit exceeded" }, {
      status: 429,
      headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" },
    });
  }

  const { series, id } = await params;
  const cacheKey = `image:${series}:${id}`;

  let buf = mediaCache.get(cacheKey);
  if (!buf) {
    const row = getDb(series)
      .prepare("SELECT seconds, video_path FROM subtitles WHERE id = ?")
      .get(id) as Pick<SubtitleRow, "seconds" | "video_path"> | undefined;

    if (!row) return Response.json({ error: "not found" }, { status: 404 });

    buf = await extractFrame(row.video_path, series, row.seconds);
    mediaCache.set(cacheKey, buf);
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}

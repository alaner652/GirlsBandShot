import { NextRequest } from "next/server";
import { getDb, SubtitleRow } from "@/lib/db";
import { createGif } from "@/lib/ffmpeg";
import { mediaCache } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const { series, id } = await params;
  const cacheKey = `gif:${series}:${id}`;

  let buf = mediaCache.get(cacheKey);
  if (!buf) {
    const row = getDb(series)
      .prepare("SELECT seconds, end_seconds, video_path FROM subtitles WHERE id = ?")
      .get(id) as Pick<SubtitleRow, "seconds" | "end_seconds" | "video_path"> | undefined;

    if (!row) return Response.json({ error: "not found" }, { status: 404 });

    const endSeconds = row.end_seconds ?? row.seconds + 3;
    buf = await createGif(row.video_path, series, row.seconds, endSeconds);
    mediaCache.set(cacheKey, buf);
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

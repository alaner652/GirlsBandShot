import { NextRequest } from "next/server";
import { getDb, SubtitleRow } from "@/lib/db";
import { extractFrame } from "@/lib/ffmpeg";
import { mediaCache } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const { series, id: rawId } = await params;
  const id = rawId.replace(/\.(png|jpg|jpeg)$/, "");
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
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

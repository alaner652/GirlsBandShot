import { getDb, SubtitleRow } from "@/lib/db";
import { extractFrame, createGif } from "@/lib/ffmpeg";
import { mediaCache } from "@/lib/cache";

export async function getFrameBuffer(series: string, id: string): Promise<Buffer | null> {
  const cacheKey = `image:${series}:${id}`;
  let buf = mediaCache.get(cacheKey);
  if (!buf) {
    const row = getDb(series)
      .prepare("SELECT seconds, video_path FROM subtitles WHERE id = ?")
      .get(id) as Pick<SubtitleRow, "seconds" | "video_path"> | undefined;
    if (!row) return null;
    buf = await extractFrame(row.video_path, series, row.seconds);
    mediaCache.set(cacheKey, buf);
  }
  return buf as Buffer;
}

export async function getGifBuffer(series: string, id: string): Promise<Buffer | null> {
  const cacheKey = `gif:${series}:${id}`;
  let buf = mediaCache.get(cacheKey);
  if (!buf) {
    const row = getDb(series)
      .prepare("SELECT seconds, end_seconds, video_path FROM subtitles WHERE id = ?")
      .get(id) as Pick<SubtitleRow, "seconds" | "end_seconds" | "video_path"> | undefined;
    if (!row) return null;
    const endSeconds = row.end_seconds ?? row.seconds + 3;
    buf = await createGif(row.video_path, series, row.seconds, endSeconds);
    mediaCache.set(cacheKey, buf);
  }
  return buf as Buffer;
}

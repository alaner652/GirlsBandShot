import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

function resolveVideoPath(videoPath: string, series: string): string {
  if (path.isAbsolute(videoPath)) return videoPath;
  const base = process.env.DATA_BASE ?? "./data";
  return path.resolve(base, series, videoPath);
}

export async function extractFrame(videoPath: string, series: string, seconds: number): Promise<Buffer> {
  const resolved = resolveVideoPath(videoPath, series);
  const { stdout } = await execFileAsync(
    FFMPEG,
    [
      "-ss", String(seconds),
      "-i", resolved,
      "-vframes", "1",
      "-vf", "scale=1920:1080",
      "-f", "image2",
      "-vcodec", "mjpeg",
      "-q:v", "3",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 20 * 1024 * 1024 }
  );
  return stdout as unknown as Buffer;
}

export async function createGif(
  videoPath: string,
  series: string,
  startSeconds: number,
  endSeconds: number,
  fps = 10,
  width = 640
): Promise<Buffer> {
  const resolved = resolveVideoPath(videoPath, series);
  const duration = Math.max(endSeconds - startSeconds, 0.5);
  const { stdout } = await execFileAsync(
    FFMPEG,
    [
      "-ss", String(startSeconds),
      "-t", String(duration),
      "-i", resolved,
      "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos`,
      "-f", "gif",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 50 * 1024 * 1024 }
  );
  return stdout as unknown as Buffer;
}

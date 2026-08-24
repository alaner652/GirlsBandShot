import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

/** 媒體生成失敗。message 給使用者，detail 給 log（ffmpeg stderr、實際路徑）。 */
export class MediaError extends Error {
  constructor(
    message: string,
    readonly detail?: string
  ) {
    super(message);
    this.name = "MediaError";
  }
}

function resolveVideoPath(videoPath: string, series: string): string {
  const base = process.env.DATA_BASE ?? "./data";
  const resolved = path.isAbsolute(videoPath)
    ? videoPath
    : path.resolve(base, series, videoPath);

  if (!fs.existsSync(resolved)) {
    throw new MediaError(
      "video not found",
      `series=${series} video_path=${videoPath} → ${resolved}（DB 的 video_path 應為 videos/xxx.mp4；` +
        `若是舊版 extractor 產的相對路徑，需重建 DB。也可能是影片沒 rsync 上來：./deploy.sh data ${series}）`
    );
  }
  return resolved;
}

async function runFfmpeg(args: string[], maxBuffer: number, what: string): Promise<Buffer> {
  let stdout: Buffer;
  try {
    ({ stdout } = (await execFileAsync(FFMPEG, args, {
      encoding: "buffer",
      maxBuffer,
    })) as unknown as { stdout: Buffer });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString().trim();
    throw new MediaError(`ffmpeg ${what} failed`, stderr || (err as Error).message);
  }

  // ffmpeg 可能 exit 0 卻沒輸出（例如 -ss 超過影片長度），別讓 0 byte 的圖流出去
  if (stdout.length === 0) {
    throw new MediaError(`ffmpeg ${what} produced no output`, `args=${args.join(" ")}`);
  }
  return stdout;
}

export async function extractFrame(videoPath: string, series: string, seconds: number): Promise<Buffer> {
  const resolved = resolveVideoPath(videoPath, series);
  return runFfmpeg(
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
    20 * 1024 * 1024,
    "frame extract"
  );
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
  return runFfmpeg(
    [
      "-ss", String(startSeconds),
      "-t", String(duration),
      "-i", resolved,
      "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos`,
      "-f", "gif",
      "pipe:1",
    ],
    50 * 1024 * 1024,
    "gif encode"
  );
}

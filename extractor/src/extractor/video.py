from __future__ import annotations

import csv
from pathlib import Path

import ffmpeg


def get_video_info(video_path: str) -> tuple[float, float]:
    """回傳 (fps, duration_seconds)。"""
    probe = ffmpeg.probe(video_path)
    stream = probe["streams"][0]
    fps_str = stream["r_frame_rate"]
    num, den = fps_str.split("/")
    fps = float(num) / float(den)
    duration = float(stream["duration"])
    return fps, duration


def extract_frame(video_path: str, frame: int, fps: float) -> bytes:
    """擷取指定幀號的圖片，回傳 PNG bytes。"""
    timestamp = frame / fps
    out, _ = (
        ffmpeg.input(video_path, ss=timestamp)
        .filter("scale", 1920, 1080)
        .output("pipe:", format="image2", vframes=1, vcodec="png")
        .run(capture_stdout=True, capture_stderr=True)
    )
    return out



def create_gif(
    video_path: str,
    start_seconds: float,
    end_seconds: float,
    fps: int = 10,
    width: int = 640,
) -> bytes:
    """從影片片段生成 GIF，回傳 bytes。"""
    duration = max(end_seconds - start_seconds, 0.5)
    out, _ = (
        ffmpeg.input(video_path, ss=start_seconds, t=duration)
        .filter("fps", fps)
        .filter("scale", width, -1, flags="lanczos")
        .output("pipe:", format="gif")
        .run(capture_stdout=True, capture_stderr=True)
    )
    return out


def download_url(url: str, output_dir: str) -> None:
    """下載單一 YouTube URL 的影片到 output_dir。"""
    import yt_dlp

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    ydl_opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/mp4",
        "outtmpl": str(output / "%(title)s.%(ext)s"),
        "quiet": False,
        "merge_output_format": "mp4",
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    print(f"\n完成，輸出至 {output}")


def download_from_csv(csv_path: str, output_dir: str) -> None:
    """從 CSV 檔案讀取 YouTube 連結並下載影片到 output_dir。"""
    import yt_dlp

    csv_file = Path(csv_path)
    if not csv_file.exists():
        raise FileNotFoundError(f"找不到 CSV 檔案：{csv_path}")

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    with open(csv_file, encoding="utf-8") as f:
        urls = [row[0].strip() for row in csv.reader(f) if row and row[0].strip()]

    if not urls:
        print("CSV 中沒有找到任何 URL。")
        return

    print(f"找到 {len(urls)} 個影片待下載")

    ydl_opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/mp4",
        "outtmpl": str(output / "%(title)s.%(ext)s"),
        "quiet": False,
        "merge_output_format": "mp4",
    }

    success = 0
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for i, url in enumerate(urls, 1):
            print(f"\n[{i}/{len(urls)}] {url}")
            try:
                ydl.download([url])
                success += 1
            except Exception as e:
                print(f"下載失敗：{e}")

    print(f"\n完成：{success}/{len(urls)} 成功，輸出至 {output}")

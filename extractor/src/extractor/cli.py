from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Annotated, Optional

import typer
import yaml
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table

from .models import Config
from .pipeline import Pipeline
from .storage import SQLiteStorage, SupabaseStorage
from .video import download_from_csv, download_url

load_dotenv()

app = typer.Typer(help="字幕擷取工具", rich_markup_mode="rich")
console = Console()


def _load_config(config_path: str) -> Config:
    with open(config_path, encoding="utf-8") as f:
        return Config.from_dict(yaml.safe_load(f))


def _resolve_paths(
    series: str | None,
    data_dir: str | None,
    videos_dir: str | None,
    db_path: str | None,
) -> tuple[str, str]:
    if series and data_dir:
        base = Path(data_dir) / series
        resolved_videos = videos_dir or str(base / "videos")
        resolved_db = db_path or str(base / "subtitles.db")
    else:
        resolved_videos = videos_dir or "videos"
        resolved_db = db_path or "output/subtitles.db"
    return resolved_videos, resolved_db


def _get_storage(backend: str, config: Config, db_path: str):
    if backend == "supabase":
        return SupabaseStorage(config)
    return SQLiteStorage(db_path)


@app.command()
def process(
    episode: Annotated[str, typer.Option("--episode", "-e", help="集數，例如 01")],
    video: Annotated[str, typer.Option("--video", "-v", help="影片檔案路徑")],
    series: Annotated[Optional[str], typer.Option("--series", "-s")] = None,
    data_dir: Annotated[Optional[str], typer.Option("--data-dir")] = None,
    db_path: Annotated[Optional[str], typer.Option("--db")] = None,
    config: Annotated[str, typer.Option("--config", "-c")] = "config.yaml",
    backend: Annotated[str, typer.Option("--backend")] = "sqlite",
    dry_run: Annotated[bool, typer.Option("--dry-run")] = False,
) -> None:
    """處理單一影片，擷取字幕並寫入 DB。"""
    if not Path(video).exists():
        console.print(f"[red]找不到影片：{video}[/]")
        raise typer.Exit(1)

    _, resolved_db = _resolve_paths(series, data_dir, None, db_path)

    cfg = _load_config(config)
    pipeline = Pipeline(cfg)
    storage = None if dry_run else _get_storage(backend, cfg, resolved_db)

    if storage:
        storage.ensure_episode(episode)

    count = 0
    for entry in pipeline.process_video(video, episode):
        count += 1
        if not dry_run and storage:
            storage.upsert(entry)

    console.print(Panel.fit(f"[green bold]完成：共 {count} 筆字幕[/]", border_style="green"))


@app.command()
def process_all(
    series: Annotated[Optional[str], typer.Option("--series", "-s")] = None,
    data_dir: Annotated[Optional[str], typer.Option("--data-dir")] = None,
    videos_dir: Annotated[Optional[str], typer.Option("--videos-dir")] = None,
    db_path: Annotated[Optional[str], typer.Option("--db")] = None,
    config: Annotated[str, typer.Option("--config", "-c")] = "config.yaml",
    backend: Annotated[str, typer.Option("--backend")] = "sqlite",
    dry_run: Annotated[bool, typer.Option("--dry-run")] = False,
    start_episode: Annotated[int, typer.Option("--start")] = 1,
) -> None:
    """批次處理影片資料夾下所有 .mp4。"""
    resolved_videos, resolved_db = _resolve_paths(series, data_dir, videos_dir, db_path)
    videos_path = Path(resolved_videos)

    if not videos_path.is_dir():
        console.print(f"[red]找不到目錄：{resolved_videos}[/]")
        raise typer.Exit(1)

    mp4_files = sorted(videos_path.glob("*.mp4"))
    if not mp4_files:
        console.print("[yellow]沒有找到任何 .mp4 檔案。[/]")
        raise typer.Exit(0)

    console.print(Panel(
        f"[bold]系列：[cyan]{series or '(未指定)'}[/cyan][/bold]\n"
        f"影片目錄：[dim]{resolved_videos}[/dim]\n"
        f"DB 輸出：[dim]{resolved_db}[/dim]\n"
        f"找到 [green]{len(mp4_files)}[/green] 個影片，從第 [cyan]{start_episode}[/cyan] 集開始",
        title="[bold]批次擷取字幕[/bold]",
        border_style="blue",
    ))

    cfg = _load_config(config)
    pipeline = Pipeline(cfg)
    storage = None if dry_run else _get_storage(backend, cfg, resolved_db)

    total_subtitles = 0

    for i, mp4 in enumerate(mp4_files):
        episode = f"{start_episode + i:02d}"
        rel_video = str(Path("videos") / mp4.name)

        console.print(Rule(f"[bold blue]EP{episode}[/]  [dim]{mp4.name}[/dim]"))

        if storage:
            storage.ensure_episode(episode)

        count = 0
        for entry in pipeline.process_video(str(mp4), episode):
            entry.video_path = rel_video
            count += 1
            if storage:
                storage.upsert(entry)

        total_subtitles += count

    console.print(Panel.fit(
        f"[green bold]全部完成！[/]\n共 {len(mp4_files)} 集，{total_subtitles} 筆字幕",
        border_style="green",
    ))


@app.command()
def download(
    url: Annotated[Optional[str], typer.Option("--url", "-u")] = None,
    csv_path: Annotated[Optional[str], typer.Option("--csv")] = None,
    series: Annotated[Optional[str], typer.Option("--series", "-s")] = None,
    data_dir: Annotated[Optional[str], typer.Option("--data-dir")] = None,
    output_dir: Annotated[Optional[str], typer.Option("--output", "-o")] = None,
) -> None:
    """下載 YouTube 影片：指定單一 --url 或從 --csv 批次下載。"""
    if url and csv_path:
        console.print("[red]請擇一使用 --url 或 --csv，不可同時指定。[/]")
        raise typer.Exit(1)

    resolved_videos, _ = _resolve_paths(series, data_dir, output_dir, None)

    if url:
        download_url(url, resolved_videos)
    else:
        download_from_csv(csv_path or "yt-to-mp4.csv", resolved_videos)


@app.command()
def stats(
    series: Annotated[Optional[str], typer.Option("--series", "-s")] = None,
    data_dir: Annotated[Optional[str], typer.Option("--data-dir")] = None,
    db_path: Annotated[Optional[str], typer.Option("--db")] = None,
) -> None:
    """顯示 DB 統計：每集字幕數、覆蓋時長、平均信心度。"""
    _, resolved_db = _resolve_paths(series, data_dir, None, db_path)

    if not Path(resolved_db).exists():
        console.print(f"[red]找不到 DB：{resolved_db}[/]")
        raise typer.Exit(1)

    with sqlite3.connect(resolved_db) as conn:
        rows = conn.execute("""
            SELECT s.episode_id, e.title,
                   COUNT(*) AS count,
                   MAX(s.end_seconds) AS duration,
                   SUM(CASE WHEN s.end_seconds IS NOT NULL THEN s.end_seconds - s.seconds ELSE 0 END) AS coverage,
                   AVG(s.confidence) AS avg_conf
            FROM subtitles s
            LEFT JOIN episodes e ON s.episode_id = e.id
            GROUP BY s.episode_id
            ORDER BY s.episode_id
        """).fetchall()

    if not rows:
        console.print("[yellow]DB 是空的。[/]")
        return

    table = Table(title=f"字幕統計  [dim]{resolved_db}[/dim]", border_style="dim")
    table.add_column("EP", style="bold cyan", justify="center")
    table.add_column("筆數", justify="right", style="green")
    table.add_column("覆蓋", justify="right")
    table.add_column("時長", justify="right")
    table.add_column("信心度", justify="right")
    table.add_column("標題", style="dim")

    total_count = 0
    for episode_id, title, count, duration, coverage, avg_conf in rows:
        duration = duration or 0
        pct = (coverage / duration * 100) if duration > 0 else 0
        conf_style = "green" if avg_conf >= 0.9 else "yellow" if avg_conf >= 0.7 else "red"
        table.add_row(
            episode_id,
            str(count),
            f"{coverage:.1f}s ({pct:.1f}%)",
            f"{duration:.1f}s",
            f"[{conf_style}]{avg_conf:.2f}[/]",
            title or "",
        )
        total_count += count

    console.print(table)
    console.print(f"[dim]共計 {len(rows)} 集，[green]{total_count}[/green] 筆字幕[/]")


@app.command()
def search(
    keyword: Annotated[str, typer.Option("--keyword", "-k")],
    series: Annotated[Optional[str], typer.Option("--series", "-s")] = None,
    data_dir: Annotated[Optional[str], typer.Option("--data-dir")] = None,
    db_path: Annotated[Optional[str], typer.Option("--db")] = None,
    episode: Annotated[Optional[str], typer.Option("--episode", "-e")] = None,
    limit: Annotated[int, typer.Option("--limit", "-n")] = 20,
) -> None:
    """在 DB 中搜尋字幕關鍵字。"""
    _, resolved_db = _resolve_paths(series, data_dir, None, db_path)

    if not Path(resolved_db).exists():
        console.print(f"[red]找不到 DB：{resolved_db}[/]")
        raise typer.Exit(1)

    with sqlite3.connect(resolved_db) as conn:
        rows = conn.execute(
            """SELECT id, episode_id, timestamp, end_seconds, text, confidence
               FROM subtitles
               WHERE text LIKE ?
                 AND (episode_id = ? OR ? IS NULL)
               ORDER BY episode_id, seconds
               LIMIT ?""",
            (f"%{keyword}%", episode, episode, limit),
        ).fetchall()

    if not rows:
        console.print(f"[yellow]找不到含「{keyword}」的字幕。[/]")
        return

    table = Table(
        title=f"搜尋「[bold]{keyword}[/bold]」  [dim]找到 {len(rows)} 筆[/dim]",
        border_style="dim",
    )
    table.add_column("EP", style="cyan", justify="center")
    table.add_column("時間軸")
    table.add_column("信心度", justify="right")
    table.add_column("字幕", style="bold")

    for _, ep, ts, end_sec, text, conf in rows:
        end_str = f"→ {end_sec:.1f}s" if end_sec else ""
        conf_style = "green" if conf >= 0.9 else "yellow" if conf >= 0.7 else "red"
        table.add_row(
            ep,
            f"{ts}  [dim]{end_str}[/dim]",
            f"[{conf_style}]{conf:.2f}[/]",
            text,
        )

    console.print(table)


if __name__ == "__main__":
    app()

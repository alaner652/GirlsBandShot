from __future__ import annotations

from difflib import SequenceMatcher
from typing import Iterator

from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)

from .models import Config, SubtitleEntry
from .ocr import OCRProcessor
from .video import extract_frame, get_video_info

_console = Console()


def _seconds_to_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def _is_similar(a: str, b: str, threshold: float) -> bool:
    if not b:
        return False
    return (1 - SequenceMatcher(None, a.lower(), b.lower()).ratio()) < threshold


class Pipeline:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._ocr = OCRProcessor(config)

    def process_video(self, video_path: str, episode: str) -> Iterator[SubtitleEntry]:
        fps, duration = get_video_info(video_path)
        total_frames = int(duration * fps)
        step = self._config.coarse_step
        coarse_steps = total_frames // step + 1

        buffered: SubtitleEntry | None = None
        last_saved_text = ""
        found = 0
        frame = 0

        with Progress(
            SpinnerColumn(),
            TextColumn(f"[bold cyan]EP{episode}[/]  [dim]{{task.description}}[/]"),
            BarColumn(bar_width=40),
            MofNCompleteColumn(),
            TextColumn("·"),
            TimeElapsedColumn(),
            console=_console,
            transient=False,
        ) as progress:
            task = progress.add_task("粗掃", total=coarse_steps)

            while frame < total_frames:
                progress.update(task, advance=1)
                result = self._ocr_frame(video_path, frame, fps)

                if result is not None:
                    text, confidence = result

                    if not _is_similar(text, last_saved_text, self._config.similarity_threshold):
                        precise_frame = self._fine_scan(
                            video_path, fps,
                            start=max(0, frame - step),
                            end=frame,
                            last_text=last_saved_text,
                        )

                        precise_result = self._ocr_frame(video_path, precise_frame, fps)
                        if precise_result is None:
                            frame += step
                            continue
                        text, confidence = precise_result

                        if confidence >= self._config.ocr_confidence_threshold:
                            if buffered is not None:
                                buffered.end_frame = precise_frame - 1
                                buffered.end_seconds = (precise_frame - 1) / fps
                                found += 1
                                progress.console.log(
                                    f"[green]✓[/] [{found}] [bold]{buffered.timestamp}[/]"
                                    f"  conf=[yellow]{buffered.confidence:.2f}[/]"
                                    f"  {buffered.text!r}"
                                )
                                yield buffered

                            seconds = precise_frame / fps
                            buffered = SubtitleEntry(
                                episode=episode,
                                frame=precise_frame,
                                timestamp=_seconds_to_timestamp(seconds),
                                seconds=seconds,
                                text=text,
                                confidence=confidence,
                                video_path=video_path,
                            )
                            last_saved_text = text

                frame += step

            # flush last entry
            if buffered is not None:
                buffered.end_frame = total_frames - 1
                buffered.end_seconds = duration
                found += 1
                progress.console.log(
                    f"[green]✓[/] [{found}] [bold]{buffered.timestamp}[/]"
                    f"  conf=[yellow]{buffered.confidence:.2f}[/]"
                    f"  {buffered.text!r}"
                )
                yield buffered

            progress.update(task, description=f"完成 · [green]{found} 筆字幕[/]")

    def _fine_scan(self, video_path: str, fps: float, start: int, end: int, last_text: str) -> int:
        candidate = end
        for frame in range(start, end + 1):
            result = self._ocr_frame(video_path, frame, fps)
            if result is None:
                continue
            text, _ = result
            if not _is_similar(text, last_text, self._config.similarity_threshold):
                candidate = frame
                break
        return candidate

    def _ocr_frame(self, video_path: str, frame: int, fps: float) -> tuple[str, float] | None:
        try:
            frame_bytes = extract_frame(video_path, frame, fps)
            return self._ocr.read_frame(frame_bytes)
        except Exception as e:
            _console.log(f"[red][警告][/] 第 {frame} 幀 OCR 失敗：{e}")
            return None

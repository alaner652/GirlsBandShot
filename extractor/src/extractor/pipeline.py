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
        buffer_frames = int(self._config.end_buffer_seconds * fps)
        sim = self._config.similarity_threshold
        conf_th = self._config.ocr_confidence_threshold

        # active = 目前畫面上的字幕（起點已知、尚未收尾）；None 代表空白段。
        active_start: int | None = None
        active_text = ""
        active_conf = 0.0
        # pending = 已知起點+自然結束幀、但等下一句起點才能 clamp 緩衝的字幕。
        pending: SubtitleEntry | None = None
        pending_natural_end = 0
        found = 0
        frame = 0

        def make_entry(start_frame: int, text: str, conf: float) -> SubtitleEntry:
            seconds = start_frame / fps
            return SubtitleEntry(
                episode=episode,
                frame=start_frame,
                timestamp=_seconds_to_timestamp(seconds),
                seconds=seconds,
                text=text,
                confidence=conf,
                video_path=video_path,
            )

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
                text = result[0] if result is not None else None

                if active_start is None:
                    # 空白段：尋找下一句字幕的起點
                    if text is not None:
                        start = self._fine_scan(
                            video_path, fps,
                            start=max(0, frame - step), end=frame,
                            ref_text="", blank_is_boundary=False,
                        )
                        start_result = self._ocr_frame(video_path, start, fps)
                        if start_result is not None and start_result[1] >= conf_th:
                            if pending is not None:
                                entry = self._finalize(pending, pending_natural_end, start,
                                                       buffer_frames, total_frames, fps)
                                found += 1
                                self._log_found(progress, found, entry)
                                yield entry
                                pending = None
                            active_start, active_text, active_conf = start, start_result[0], start_result[1]
                else:
                    # 字幕在畫面上：盯著它消失或改變
                    if text is None or not _is_similar(text, active_text, sim):
                        boundary = self._fine_scan(
                            video_path, fps,
                            start=max(active_start + 1, frame - step), end=frame,
                            ref_text=active_text, blank_is_boundary=True,
                        )
                        natural_end = boundary - 1
                        entry = make_entry(active_start, active_text, active_conf)
                        boundary_result = self._ocr_frame(video_path, boundary, fps)
                        back_to_back = (
                            boundary_result is not None
                            and boundary_result[1] >= conf_th
                            and not _is_similar(boundary_result[0], active_text, sim)
                        )
                        if back_to_back:
                            # 緊接字幕：以 boundary 為界收尾（緩衝歸零），直接接上新句
                            entry = self._finalize(entry, natural_end, boundary,
                                                   buffer_frames, total_frames, fps)
                            found += 1
                            self._log_found(progress, found, entry)
                            yield entry
                            active_start, active_text, active_conf = boundary, boundary_result[0], boundary_result[1]
                        else:
                            # 進入空白段：暫存，等下一句起點再定案結束點
                            pending = entry
                            pending_natural_end = natural_end
                            active_start = None

                frame += step

            # flush：影片結束時收尾殘留的 active / pending
            if active_start is not None:
                entry = self._finalize(make_entry(active_start, active_text, active_conf),
                                       total_frames - 1, None, buffer_frames, total_frames, fps)
                found += 1
                self._log_found(progress, found, entry)
                yield entry
            elif pending is not None:
                entry = self._finalize(pending, pending_natural_end, None,
                                       buffer_frames, total_frames, fps)
                found += 1
                self._log_found(progress, found, entry)
                yield entry

            progress.update(task, description=f"完成 · [green]{found} 筆字幕[/]")

    def _finalize(
        self, entry: SubtitleEntry, natural_end: int, next_start: int | None,
        buffer_frames: int, total_frames: int, fps: float,
    ) -> SubtitleEntry:
        """把結束點定為 min(自然結束 + 緩衝, 下一句起點)，並確保不早於自身起點。"""
        cap = next_start if next_start is not None else total_frames
        end_frame = min(natural_end + buffer_frames, cap - 1)
        end_frame = max(end_frame, entry.frame)
        entry.end_frame = end_frame
        entry.end_seconds = end_frame / fps
        return entry

    @staticmethod
    def _log_found(progress: Progress, found: int, entry: SubtitleEntry) -> None:
        dur = (entry.end_seconds - entry.seconds) if entry.end_seconds is not None else 0.0
        progress.console.log(
            f"[green]✓[/] [{found}] [bold]{entry.timestamp}[/]"
            f"  [dim]{dur:.1f}s[/]"
            f"  conf=[yellow]{entry.confidence:.2f}[/]"
            f"  {entry.text!r}"
        )

    def _fine_scan(
        self, video_path: str, fps: float, start: int, end: int,
        ref_text: str, blank_is_boundary: bool,
    ) -> int:
        """回傳 [start, end] 內第一個「邊界幀」。

        邊界 = 與 ref_text 不相似的字幕幀；當 blank_is_boundary=True 時，
        空白幀（OCR 無結果）也算邊界（用於偵測字幕消失）。
        """
        candidate = end
        for frame in range(start, end + 1):
            result = self._ocr_frame(video_path, frame, fps)
            if result is None:
                if blank_is_boundary:
                    candidate = frame
                    break
                continue
            text, _ = result
            if not _is_similar(text, ref_text, self._config.similarity_threshold):
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

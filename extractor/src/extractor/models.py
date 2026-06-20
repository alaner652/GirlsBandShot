from dataclasses import dataclass, field
from typing import Any


@dataclass
class Config:
    ocr_languages: list[str]
    ocr_confidence_threshold: float
    subtitle_region_top: float
    subtitle_region_bottom: float
    coarse_step: int
    similarity_threshold: float
    max_repeats: int
    image_resolution: tuple[int, int]
    supabase_bucket: str

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Config":
        return cls(
            ocr_languages=d["ocr"]["languages"],
            ocr_confidence_threshold=d["ocr"]["confidence_threshold"],
            subtitle_region_top=d["ocr"]["subtitle_region"]["top"],
            subtitle_region_bottom=d["ocr"]["subtitle_region"]["bottom"],
            coarse_step=d["extraction"]["coarse_step"],
            similarity_threshold=d["extraction"]["similarity_threshold"],
            max_repeats=d["extraction"]["max_repeats"],
            image_resolution=tuple(d["image"]["resolution"]),
            supabase_bucket=d["supabase"]["bucket"],
        )


@dataclass
class SubtitleEntry:
    episode: str
    frame: int
    timestamp: str    # "00:01:23"
    seconds: float
    text: str
    confidence: float
    video_path: str
    end_frame: int | None = None
    end_seconds: float | None = None

    @property
    def id(self) -> str:
        return f"ep_{self.episode}_frame_{self.frame:06d}"

    @property
    def duration(self) -> float | None:
        if self.end_seconds is not None:
            return self.end_seconds - self.seconds
        return None

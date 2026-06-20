from __future__ import annotations

import io
import warnings
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image, ImageEnhance

if TYPE_CHECKING:
    import easyocr

    from .models import Config


def get_device() -> str:
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


class OCRProcessor:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._reader: easyocr.Reader | None = None

    def _get_reader(self) -> easyocr.Reader:
        if self._reader is None:
            import easyocr

            device = get_device()
            self._reader = easyocr.Reader(
                self._config.ocr_languages,
                gpu=(device in ("cuda", "mps")),
            )
        return self._reader

    def read_frame(self, frame_bytes: bytes) -> tuple[str, float] | None:
        """從整幀圖片中辨識字幕區域，回傳 (text, confidence) 或 None。"""
        image = Image.open(io.BytesIO(frame_bytes))
        image = self._resize_for_ocr(image)
        region = self._crop_subtitle_region(image)
        region = self._preprocess(region)
        return self._run_ocr(region)

    def _resize_for_ocr(self, image: Image.Image) -> Image.Image:
        target_w, target_h = self._config.image_resolution
        if image.size != (target_w, target_h):
            image = image.resize((target_w, target_h), Image.LANCZOS)
        return image

    def _crop_subtitle_region(self, image: Image.Image) -> Image.Image:
        w, h = image.size
        top = int(h * self._config.subtitle_region_top)
        bottom = int(h * self._config.subtitle_region_bottom)
        return image.crop((0, top, w, bottom))

    def _preprocess(self, image: Image.Image) -> Image.Image:
        image = image.convert("L")
        image = ImageEnhance.Contrast(image).enhance(1.5)
        image = ImageEnhance.Brightness(image).enhance(1.4)
        image = ImageEnhance.Sharpness(image).enhance(1.3)
        return image

    def _run_ocr(self, image: Image.Image) -> tuple[str, float] | None:
        arr = np.array(image)
        reader = self._get_reader()
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="'pin_memory'")
            results = reader.readtext(arr, detail=1)

        if not results:
            return None

        candidates = [
            (text, conf)
            for _, text, conf in results
            if conf >= 0.5 and text.strip()
        ]
        if not candidates:
            return None

        text, confidence = max(candidates, key=lambda x: x[1])
        return text.strip(), confidence

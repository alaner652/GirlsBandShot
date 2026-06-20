# Ave Mujica Extractor

從 YouTube 影片擷取字幕與時間軸，供後續 API 查詢與 GIF 生成使用。

## 架構思路

不預存截圖，只存字幕文字 + 時間軸（`start_seconds`, `end_seconds`）+ 影片路徑。
截圖和 GIF 全部由 API 即時用 ffmpeg 從原始影片生成，熱門片段加 LRU 快取。

```
extraction（跑一次）
  影片 → OCR → SQLite (text, start, end, video_path)

API（每次請求）
  GET /image?id=xxx  →  ffmpeg 截一幀  →  PNG
  GET /gif?id=xxx    →  ffmpeg 切片段  →  GIF  +  LRU cache
```

## 安裝

```bash
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e .
brew install ffmpeg            # macOS
# apt install ffmpeg           # Linux
```

## 使用

### 下載影片

```bash
# 單一 URL
python -m extractor.cli download --url "https://youtube.com/watch?v=..."

# 從 CSV 批次下載（格式：每行一個 URL）
python -m extractor.cli download --csv yt-to-mp4.csv
```

### 擷取字幕

```bash
# 測試單集（不寫 DB）
python -m extractor.cli process -e 01 -v videos/ep01.mp4 --dry-run

# 單集正式執行
python -m extractor.cli process -e 01 -v videos/ep01.mp4

# 批次處理整個 videos/ 資料夾（背景執行）
nohup python -m extractor.cli process-all > logs/process.log 2>&1 &
tail -f logs/process.log
```

### 切換後端

```bash
# 預設 SQLite（本地）
python -m extractor.cli process-all

# 換成 Supabase（需設定 .env）
python -m extractor.cli process-all --backend supabase
```

## 設定

複製 `.env.example` 為 `.env`，填入 Supabase 金鑰（僅使用 Supabase 後端時需要）：

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

OCR 相關參數在 `config.yaml` 調整（字幕區域、信心度門檻、掃描步距等）。

## 輸出

```
output/
└── subtitles.db     # SQLite，含 episodes + subtitles 兩個 table
```

影片檔案保留在 `videos/`，API 生成截圖與 GIF 時使用。

## 技術說明

- **二階段掃描**：粗掃（每 N 幀）偵測字幕變化點，細掃確定精確起始幀
- **Mac / Linux 相容**：自動偵測 CUDA（Linux）或回落 CPU（Mac）
- **GIF 生成**（供 API 使用）：

```python
from extractor.video import create_gif

gif_bytes = create_gif(
    video_path="videos/ep01.mp4",
    start_seconds=21.0,
    end_seconds=24.0,
)
```

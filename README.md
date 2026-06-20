# 雞狗查圖

字幕截圖搜尋。輸入一句台詞，找到那個畫面，即時生成截圖或 GIF。

## 架構

```
AveMujicaBot/
├── extractor/      # Python — OCR 掃描字幕、寫入 SQLite
└── web/            # Next.js — 搜尋 UI + 即時截圖/GIF API
    └── data/       # 執行時資料（不進 git）
        ├── ave-mujica/
        │   ├── videos/       ← mp4 放這
        │   └── subtitles.db  ← extractor 輸出
        └── mygo/             ← 之後加的系列
            ├── videos/
            └── subtitles.db
```

影片保留在本機／伺服器，截圖與 GIF 由 ffmpeg 即時生成。DB 只存文字、時間軸、影片相對路徑。**DB 已納入版本控管，clone 即可搜尋。**

## 快速開始

### 1. 準備影片

將 mp4 放到 `web/data/{系列名}/videos/` 下：

```bash
mkdir -p web/data/ave-mujica/videos
# 或用 extractor 下載
cd extractor && python -m extractor.cli download \
  --csv yt-to-mp4.csv --series ave-mujica --data-dir ../web/data
```

### 2. Extractor（Python）

```bash
cd extractor
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# 批次擷取字幕（輸出到 web/data/ave-mujica/subtitles.db）
nohup python -m extractor.cli process-all \
  --series ave-mujica --data-dir ../web/data \
  > logs/process.log 2>&1 &

# 驗收
python -m extractor.cli stats --series ave-mujica --data-dir ../web/data
python -m extractor.cli search --keyword 音樂 --series ave-mujica --data-dir ../web/data
```

### 3. Web（Next.js）

```bash
cd web
npm install
cp .env.local.example .env.local   # DATA_BASE=./data
npm run dev
# 開啟 http://localhost:3000
```

## Extractor CLI 指令

| 指令 | 說明 |
|---|---|
| `download --series <s> --data-dir <d>` | 從 CSV 下載影片到 `data/{series}/videos/` |
| `process-all --series <s> --data-dir <d>` | 批次處理，DB 輸出到 `data/{series}/subtitles.db` |
| `process -e <ep> -v <file>` | 處理單集 |
| `stats --series <s> --data-dir <d>` | 顯示各集字幕統計 |
| `search --keyword <kw> --series <s>` | 搜尋字幕關鍵字 |

## Web API

| Endpoint | 說明 |
|---|---|
| `GET /api/series` | 列出可用系列 |
| `GET /api/search?keyword=&series=&episode=&page=` | 搜尋字幕 |
| `GET /api/image/{series}/{id}` | 截圖（PNG）|
| `GET /api/gif/{series}/{id}` | GIF（rate limit：10次/分） |

## 部署

DB 已在 repo 裡，clone 完立即可搜尋。影片需另外準備才有截圖/GIF。

### VPS（全功能）

```bash
# 1. clone（含 DB）
git clone https://github.com/alaner652/AveMujicaBot
cd AveMujicaBot/web

# 2. 安裝依賴 + 編譯
npm ci
npm run build

# 3. 環境變數
echo "DATA_BASE=./data" > .env.local

# 4. 啟動
npm start   # 預設 port 3000
```

影片放到 `web/data/ave-mujica/videos/` 後截圖/GIF 才會有效。
伺服器需安裝 ffmpeg（`apt install ffmpeg` / `brew install ffmpeg`）。

### Docker

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build
ENV DATA_BASE=./data
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -f Dockerfile.web -t jigou .
docker run -p 3000:3000 \
  -v $(pwd)/web/data:/app/data \
  jigou
```

### Vercel（僅搜尋）

Vercel 無 ffmpeg，截圖/GIF API 會失敗，但搜尋功能正常。

```bash
cd web
vercel deploy
# 在 Vercel 環境變數設 DATA_BASE=./data
```

> better-sqlite3 是 native module，Vercel 部署前需確認 Node.js runtime 版本一致。

## 技術棧

- **Extractor**：Python、EasyOCR、yt-dlp、SQLite
- **Web**：Next.js、better-sqlite3、LRU cache、ffmpeg、shadcn/ui、Tailwind CSS

## 作者

[alaner652](https://alaner652.com) · [GitHub](https://github.com/alaner652)

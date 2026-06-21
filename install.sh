#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
warn() { echo -e "  ${YELLOW}!${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC}  $*"; }
ask()  { echo -e -n "  ${BOLD}$*${NC} "; }

SERIES="ave-mujica"
VIDEOS_DIR="web/data/${SERIES}/videos"

# ── 檢查狀態 ──────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}GirlsBandShot 安裝${NC}\n"
echo -e "${BOLD}── 檢查配置 ──${NC}"

HAS_CF=false
HAS_ENVLOCAL=false
HAS_VIDEOS=false

# CF Token
if [ -f .env ] && grep -q "CLOUDFLARE_TUNNEL_TOKEN=." .env; then
  ok "CF Tunnel Token 已配置"
  HAS_CF=true
else
  warn "CF Tunnel Token 未設定"
fi

# web/.env.local
if [ -f web/.env.local ] && grep -q "DATA_BASE" web/.env.local; then
  ok "web/.env.local 已配置"
  HAS_ENVLOCAL=true
else
  warn "web/.env.local 未設定"
fi

# 影片
VIDEO_COUNT=$(find "$VIDEOS_DIR" -name "*.mp4" 2>/dev/null | wc -l | tr -d ' ')
if [ "$VIDEO_COUNT" -gt 0 ]; then
  ok "影片已存在（${VIDEO_COUNT} 個）"
  HAS_VIDEOS=true
else
  warn "影片尚未下載（${VIDEOS_DIR}）"
fi

# 如果全部都好了
if $HAS_CF && $HAS_ENVLOCAL && $HAS_VIDEOS; then
  echo ""
  ok "配置完整，直接啟動..."
  docker compose up -d --build
  echo ""
  ok "完成！→ http://localhost:3000"
  exit 0
fi

# ── 補齊缺少的配置 ────────────────────────────────────────────────────────────
echo -e "\n${BOLD}── 補齊配置 ──${NC}"

# CF Token
if ! $HAS_CF; then
  ask "Cloudflare Tunnel Token（留空跳過）:"
  read -r CF_TOKEN
  if [ -n "$CF_TOKEN" ]; then
    echo "CLOUDFLARE_TUNNEL_TOKEN=${CF_TOKEN}" > .env
    ok ".env 建立完成"
  else
    warn "跳過 CF Tunnel"
  fi
fi

# web/.env.local
if ! $HAS_ENVLOCAL; then
  echo "DATA_BASE=./data" > web/.env.local
  ask "API Keys（逗號分隔，留空跳過）:"
  read -r API_KEYS
  if [ -n "$API_KEYS" ]; then
    echo "API_KEYS=${API_KEYS}" >> web/.env.local
  fi
  ok "web/.env.local 建立完成"
fi

# 影片
if ! $HAS_VIDEOS; then
  ask "下載 ${SERIES} 影片？[y/N]"
  read -r -n 1 DL_CHOICE
  echo
  if [[ "${DL_CHOICE,,}" == "y" ]]; then
    mkdir -p "$VIDEOS_DIR"
    echo ""
    warn "首次會拉 Docker image，請稍候..."
    docker run --rm \
      -v "$(pwd)/extractor/yt-to-mp4.csv:/tmp/urls.txt:ro" \
      -v "$(pwd)/${VIDEOS_DIR}:/output" \
      python:3.12-slim \
      sh -c "
        apt-get update -qq && apt-get install -y ffmpeg -qq 2>/dev/null
        pip install yt-dlp -q
        yt-dlp \
          --batch-file /tmp/urls.txt \
          -o '/output/EP%(autonumber)02d.%(ext)s' \
          --merge-output-format mp4 \
          --format 'bestvideo+bestaudio/best'
      "
    ok "影片下載完成"
  fi
fi

# ── 啟動 ──────────────────────────────────────────────────────────────────────
echo ""
warn "啟動服務..."
docker compose up -d --build
echo ""
ok "完成！→ http://localhost:3000"

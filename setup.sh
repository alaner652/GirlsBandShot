#!/usr/bin/env bash
set -euo pipefail

# ── 顏色 ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}$*${NC}\n"; }
ask()     { echo -e -n "${BOLD}$*${NC} "; }

# ── 工具函數 ──────────────────────────────────────────────────────────────────
need() {
  if ! command -v "$1" &>/dev/null; then
    error "找不到 $1，請先安裝後再執行。"
    exit 1
  fi
}

confirm() {
  ask "$1 [y/N]"
  read -r ans
  [[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]]
}

prompt() {
  ask "$1 [${2}]:"
  read -r val
  echo "${val:-$2}"
}

# ── 設置 Web ──────────────────────────────────────────────────────────────────
setup_web() {
  header "📦 設置 Web"
  need node; need npm; need ffmpeg

  info "安裝 Node 依賴..."
  (cd web && npm install --silent)
  success "npm install 完成"

  if [ ! -f web/.env.local ]; then
    echo "DATA_BASE=./data" > web/.env.local
    success "建立 web/.env.local（DATA_BASE=./data）"
  else
    info "web/.env.local 已存在，略過"
  fi
}

# ── 設置 Python（Extractor）────────────────────────────────────────────────────
setup_python() {
  header "🐍 設置 Python 環境"
  need python3

  if [ ! -d extractor/.venv ]; then
    info "建立虛擬環境..."
    python3 -m venv extractor/.venv
    success "虛擬環境建立完成"
  else
    info "虛擬環境已存在，略過"
  fi

  info "安裝 Python 依賴..."
  (cd extractor && source .venv/bin/activate && pip install -e . -q)
  success "pip install 完成"
}

# ── 建立 DB ───────────────────────────────────────────────────────────────────
build_db() {
  local series="$1"
  local data_dir="web/data"

  header "🗃  建立字幕 DB — 系列：${series}"

  local videos_dir="${data_dir}/${series}/videos"
  mkdir -p "$videos_dir"

  # 取得影片
  echo -e "${BOLD}影片來源：${NC}"
  echo "  1) 從 CSV 批次下載"
  echo "  2) 指定單一 YouTube URL"
  echo "  3) 影片已在 ${videos_dir}，直接擷取"
  ask "請選擇 [1/2/3]:"
  read -r src_choice

  case "$src_choice" in
    1)
      local csv_path
      csv_path=$(prompt "CSV 檔案路徑" "extractor/yt-to-mp4.csv")
      if [ ! -f "$csv_path" ]; then
        error "找不到 CSV：${csv_path}"
        exit 1
      fi
      need yt-dlp
      info "開始下載影片..."
      (cd extractor && source .venv/bin/activate && \
        python -m extractor.cli download \
          --csv "../${csv_path}" \
          --series "$series" \
          --data-dir "../${data_dir}")
      ;;
    2)
      ask "YouTube URL:"
      read -r yt_url
      need yt-dlp
      info "下載影片：${yt_url}"
      (cd extractor && source .venv/bin/activate && \
        python -m extractor.cli download \
          --url "$yt_url" \
          --series "$series" \
          --data-dir "../${data_dir}")
      ;;
    3)
      local mp4_count
      mp4_count=$(find "$videos_dir" -name "*.mp4" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$mp4_count" -eq 0 ]; then
        error "在 ${videos_dir} 找不到任何 .mp4 檔案"
        exit 1
      fi
      info "找到 ${mp4_count} 個影片，直接開始擷取"
      ;;
    *)
      error "無效選項"
      exit 1
      ;;
  esac

  # 執行 OCR 擷取
  info "開始 OCR 擷取字幕（這可能需要一段時間...）"

  local start_ep
  start_ep=$(prompt "從第幾集開始編號" "1")

  local run_bg=false
  if confirm "在背景執行（nohup）？"; then
    run_bg=true
    mkdir -p extractor/logs
  fi

  local cmd="python -m extractor.cli process-all \
    --series ${series} \
    --data-dir ../${data_dir} \
    --start ${start_ep}"

  if [ "$run_bg" = true ]; then
    (cd extractor && source .venv/bin/activate && \
      nohup bash -c "$cmd" > "logs/${series}-$(date +%Y%m%d-%H%M%S).log" 2>&1 &)
    success "背景執行中（PID $!）"
    info "查看進度：tail -f extractor/logs/${series}-*.log"
  else
    (cd extractor && source .venv/bin/activate && bash -c "$cmd")
    success "擷取完成！DB 位於 ${data_dir}/${series}/subtitles.db"
  fi
}

# ── 啟動 Web ──────────────────────────────────────────────────────────────────
start_web() {
  header "🚀 啟動 Web"

  echo -e "${BOLD}啟動模式：${NC}"
  echo "  1) 開發模式（npm run dev）"
  echo "  2) 正式模式（npm run build && npm start）"
  ask "請選擇 [1/2]:"
  read -r mode

  case "$mode" in
    1)
      info "啟動開發伺服器..."
      (cd web && npm run dev)
      ;;
    2)
      info "建置..."
      (cd web && npm run build)
      info "啟動正式伺服器..."
      (cd web && npm start)
      ;;
    *)
      warn "略過啟動，請手動執行：cd web && npm run dev"
      ;;
  esac
}

# ── 主選單 ────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}╔══════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║       雞狗查圖  設置腳本       ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════╝${NC}\n"

echo "請選擇要執行的動作："
echo "  1) 啟動 Web（DB 已在 repo，開箱即用）"
echo "  2) 建立 DB（下載影片 + OCR 擷取字幕）"
echo "  3) 全部（設置環境 + 建 DB + 啟動 Web）"
echo "  0) 結束"
echo ""
ask "請選擇 [0-3]:"
read -r choice

case "$choice" in
  0)
    info "結束"
    exit 0
    ;;
  1)
    setup_web
    if confirm "現在啟動 Web？"; then
      start_web
    else
      success "設置完成！執行 cd web && npm run dev 啟動。"
    fi
    ;;
  2)
    setup_python
    series=$(prompt "系列名稱" "ave-mujica")
    build_db "$series"
    ;;
  3)
    setup_web
    setup_python
    series=$(prompt "系列名稱" "ave-mujica")
    build_db "$series"
    if confirm "現在啟動 Web？"; then
      start_web
    else
      success "全部完成！執行 cd web && npm run dev 啟動。"
    fi
    ;;
  *)
    error "無效選項：${choice}"
    exit 1
    ;;
esac

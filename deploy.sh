#!/usr/bin/env bash
set -euo pipefail

# ── 一鍵部署到 VM ──────────────────────────────────────────────────────────────
#
# 兩條通道：
#   code   程式碼 + meta.json          → git push / git pull + rebuild
#   data   subtitles.db + 影片          → rsync 增量推送（不走 git）
#
# 用法：
#   ./deploy.sh                 完整部署（code + data）
#   ./deploy.sh code            只更新程式碼（git pull + rebuild）
#   ./deploy.sh data            rsync 所有系列的 db + 影片，然後 restart
#   ./deploy.sh data yumemita   只 rsync 指定系列
#   ./deploy.sh restart         只重啟遠端服務
#
# 連線設定放在 deploy.env（見 deploy.env.example）。

cd "$(dirname "$0")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "\n${BOLD}▶ $*${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}!${NC} $*"; }
die()  { echo -e "  ${RED}✗${NC} $*"; exit 1; }

# ── 載入設定 ──────────────────────────────────────────────────────────────────
[ -f deploy.env ] || die "找不到 deploy.env，先執行：cp deploy.env.example deploy.env 並填入 VM 資訊"
# shellcheck disable=SC1091
set -a; source deploy.env; set +a
: "${DEPLOY_SSH:?deploy.env 缺 DEPLOY_SSH}"
: "${DEPLOY_DIR:?deploy.env 缺 DEPLOY_DIR}"

remote() { ssh "$DEPLOY_SSH" "cd $DEPLOY_DIR && $*"; }

# ── 解析參數 ──────────────────────────────────────────────────────────────────
MODE="${1:-all}"
SERIES_ARG="${2:-}"

deploy_code() {
  step "同步程式碼與字幕索引 (git)"

  if [ -n "$(git status --porcelain)" ]; then
    warn "本機有未提交的變更："
    git status --short | sed 's/^/    /'
    warn "只有已 commit 的內容會走 code 通道（db／影片走 data 通道，與此無關）"
  fi

  local branch; branch=$(git rev-parse --abbrev-ref HEAD)
  git push origin "$branch"
  ok "已 push $branch"

  step "遠端 git pull + 重建容器"
  remote "git fetch origin && git checkout $branch && git pull && docker compose up -d --build"
  ok "遠端已更新並重建"
}

deploy_data() {
  step "rsync 資料到 VM（subtitles.db + 影片）"

  local series_list
  if [ -n "${SERIES_ARG}" ]; then
    series_list="$SERIES_ARG"
  elif [ -n "${DEPLOY_SERIES:-}" ]; then
    series_list="$DEPLOY_SERIES"
  else
    # 自動偵測本機所有系列（web/data/*/）
    series_list=$(find web/data -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
                    | sed 's#web/data/##' | tr '\n' ' ')
  fi
  [ -n "$series_list" ] || die "找不到任何系列（web/data/*/）"

  for s in $series_list; do
    local src="web/data/$s/"
    [ -d "$src" ] || { warn "跳過 $s：本機無 $src"; continue; }
    local count; count=$(find "$src/videos" -name '*.mp4' 2>/dev/null | wc -l | tr -d ' ')
    local hasdb="無 db"; [ -f "$src/subtitles.db" ] && hasdb="含 db"
    echo -e "  → ${BOLD}$s${NC}（$hasdb，$count 個 mp4）"
    remote "mkdir -p web/data/$s" >/dev/null
    # 傳 subtitles.db 與 videos/；meta.json 走 git，不重複推
    rsync -avz --progress --partial --exclude 'meta.json' \
      "$src" "$DEPLOY_SSH:$DEPLOY_DIR/web/data/$s/"
    ok "$s 資料已同步"
  done
}

restart_remote() {
  step "重啟遠端服務"
  remote "docker compose restart"
  ok "已重啟"
}

# ── 執行 ──────────────────────────────────────────────────────────────────────
case "$MODE" in
  all)     deploy_code; deploy_data; restart_remote ;;
  code)    deploy_code ;;
  data)    deploy_data; restart_remote ;;
  restart) restart_remote ;;
  *)       die "未知模式：$MODE（可用 all | code | data | restart）" ;;
esac

echo -e "\n${GREEN}${BOLD}✓ 部署完成${NC}\n"

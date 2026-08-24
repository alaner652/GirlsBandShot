#!/usr/bin/env bash
set -uo pipefail

# ── 遠端診斷：圖片為什麼掛 ─────────────────────────────────────────────────────
#
# 用法：./diagnose.sh
# 連線設定沿用 deploy.env（跟 deploy.sh 同一份）。
#
# 一次把「路徑 / 磁碟 / 記憶體 / 容器 / 實際 HTTP」四層都查完，
# 不用再靠猜。

cd "$(dirname "$0")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "\n${BOLD}▶ $*${NC}"; }
die()  { echo -e "  ${RED}✗${NC} $*"; exit 1; }

[ -f deploy.env ] || die "找不到 deploy.env"
# shellcheck disable=SC1091
set -a; source deploy.env; set +a
: "${DEPLOY_SSH:?deploy.env 缺 DEPLOY_SSH}"
: "${DEPLOY_DIR:?deploy.env 缺 DEPLOY_DIR}"

remote() { ssh -o ConnectTimeout=10 "$DEPLOY_SSH" "cd $DEPLOY_DIR && $*"; }

ssh -o ConnectTimeout=10 -o BatchMode=yes "$DEPLOY_SSH" true 2>/dev/null \
  || die "連不上 $DEPLOY_SSH（不在同一個網段？先確認 VPN / 內網）"

step "1. 磁碟與記憶體"
remote "df -h / /var/lib/docker 2>/dev/null | sort -u; echo; free -m"

step "2. 容器狀態（看 RESTARTS 有沒有在跳）"
remote "docker compose ps"
echo -e "\n  ${YELLOW}重啟次數 / 是否被 OOM kill：${NC}"
remote "docker inspect \$(docker compose ps -q web) --format '  RestartCount={{.RestartCount}}  OOMKilled={{.State.OOMKilled}}  Status={{.State.Status}}  ExitCode={{.State.ExitCode}}' 2>/dev/null"

step "3. 每個系列：video_path 是否對得到檔案 + 實際打一次 API（容器內視角）"
remote "docker compose exec -T web node scripts/check-media.mjs --http"

step "4. 最近的 [media] 錯誤 log"
remote "docker compose logs web --tail=400 2>&1 | grep -A1 '\[media\]' | tail -40 || echo '  （沒有 [media] 錯誤——可能是還沒部署新版程式碼）'"

echo -e "\n${BOLD}判讀：${NC}"
echo "  第 3 步有缺檔           → 路徑問題。相對路徑錯就重建該系列 DB，整個 videos/ 缺就 ./deploy.sh data <series>"
echo "  第 3 步檔案都在但 HTTP 500 → 看第 4 步的 log"
echo "  第 3 步 HTTP 全 200      → 容器內是好的，問題在 Cloudflare Tunnel 那層（超時 / 快取）"
echo "  第 1 步磁碟滿 或 第 2 步 OOMKilled=true → 資源問題，跟即時截圖無關"
echo

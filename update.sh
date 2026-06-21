#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# GirlsBandShot 安全更新腳本
# 更新專案但保留影片和資料
# ══════════════════════════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}\n"; }

header "GirlsBandShot 更新"

# ── 檢查 Git 狀態 ─────────────────────────────────────────────────────────────
info "檢查 Git 狀態..."

if [ ! -d .git ]; then
  error "這不是一個 Git 專案目錄"
  exit 1
fi

# 檢查是否有未提交的變更
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  warn "發現未提交的變更："
  git status --short
  echo ""
  read -p "$(echo -e ${BOLD}是否要暫存這些變更並繼續？[y/N]${NC} )" -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "暫存變更..."
    git stash push -m "Auto-stash before update $(date +%Y%m%d-%H%M%S)"
    STASHED=true
  else
    error "請先處理未提交的變更"
    exit 1
  fi
else
  STASHED=false
fi

# ── 確認影片安全 ─────────────────────────────────────────────────────────────
info "確認影片目錄安全性..."

# 檢查影片目錄是否被 gitignore
if git check-ignore -q web/data/*/videos/ 2>/dev/null; then
  success "影片目錄已被 .gitignore 保護 ✓"
else
  warn "警告：影片目錄可能未被正確排除"
fi

# 列出現有影片（如果有）
if [ -d web/data ]; then
  VIDEO_COUNT=$(find web/data -type f -name "*.mp4" 2>/dev/null | wc -l)
  if [ "$VIDEO_COUNT" -gt 0 ]; then
    info "找到 $VIDEO_COUNT 個影片檔案"
    success "這些影片會被保留 ✓"
  fi
fi

# ── 拉取更新 ─────────────────────────────────────────────────────────────────
header "拉取最新代碼"

info "執行 git pull..."
if git pull; then
  success "代碼更新成功"
else
  error "git pull 失敗"
  if [ "$STASHED" = true ]; then
    info "恢復暫存的變更..."
    git stash pop
  fi
  exit 1
fi

# 恢復暫存的變更
if [ "$STASHED" = true ]; then
  info "恢復暫存的變更..."
  if git stash pop; then
    success "變更已恢復"
  else
    warn "變更恢復時發生衝突，請手動處理"
    info "查看暫存列表：git stash list"
  fi
fi

# ── 更新依賴（如果是 Docker 部署）─────────────────────────────────────────────
if [ -f docker-compose.yml ]; then
  header "更新 Docker 容器"

  read -p "$(echo -e ${BOLD}是否要重新建置並重啟容器？[Y/n]${NC} )" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    info "重新建置容器..."
    docker compose build

    info "重啟容器..."
    docker compose up -d

    success "容器已更新並重啟"

    # 顯示容器狀態
    echo ""
    docker compose ps
  fi
fi

# ── 完成 ──────────────────────────────────────────────────────────────────────
header "更新完成！"

# 驗證影片仍存在
if [ -d web/data ]; then
  FINAL_VIDEO_COUNT=$(find web/data -type f -name "*.mp4" 2>/dev/null | wc -l)
  if [ "$FINAL_VIDEO_COUNT" -gt 0 ]; then
    success "確認：$FINAL_VIDEO_COUNT 個影片檔案完好無損 ✓"
  fi
fi

echo ""
echo -e "${BOLD}更新摘要：${NC}"
echo "  最新 commit: $(git log -1 --oneline)"
echo ""

if [ -f docker-compose.yml ]; then
  echo -e "${BOLD}服務狀態：${NC}"
  echo "  查看日誌: docker compose logs -f"
  echo "  查看狀態: docker compose ps"
fi

echo ""
success "所有更新已完成，影片檔案已保留"

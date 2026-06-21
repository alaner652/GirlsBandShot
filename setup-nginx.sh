#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Nginx 反向代理自動設定腳本
# ══════════════════════════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}\n"; }

# 檢查是否為 root
if [ "$EUID" -ne 0 ]; then
  error "請使用 sudo 執行此腳本"
  echo "  sudo ./setup-nginx.sh"
  exit 1
fi

header "Nginx 反向代理設定"

# ── 收集資訊 ──────────────────────────────────────────────────────────────────
echo -e "${BOLD}請提供以下資訊：${NC}\n"

# 詢問域名或使用 IP
read -p "$(echo -e ${BOLD}請輸入域名（或按 Enter 使用 IP）:${NC} )" DOMAIN
if [ -z "$DOMAIN" ]; then
  # 使用 IP
  SERVER_IP=$(hostname -I | awk '{print $1}')
  info "使用 IP: $SERVER_IP"
  USE_DOMAIN=false
  SERVER_NAME="_"
else
  info "使用域名: $DOMAIN"
  USE_DOMAIN=true
  SERVER_NAME="$DOMAIN"
fi

# 確認 Docker 容器是否運行
if ! docker ps | grep -q girlsbandshot-web; then
  warn "Docker 容器未運行，請先啟動："
  echo "  cd ~/GirlsBandShot && docker compose up -d"
  read -p "$(echo -e ${BOLD}容器已啟動？繼續設定 Nginx？[y/N]${NC} )" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ── 安裝 Nginx ────────────────────────────────────────────────────────────────
header "安裝 Nginx"

if command -v nginx &>/dev/null; then
  info "Nginx 已安裝: $(nginx -v 2>&1)"
else
  info "安裝 Nginx..."
  apt update -qq
  apt install -y nginx
  success "Nginx 安裝完成"
fi

# ── 建立設定檔 ────────────────────────────────────────────────────────────────
header "建立 Nginx 設定"

NGINX_CONF="/etc/nginx/sites-available/girlsbandshot"

info "建立設定檔: $NGINX_CONF"

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    # 安全標頭
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 日誌
    access_log /var/log/nginx/girlsbandshot_access.log;
    error_log /var/log/nginx/girlsbandshot_error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # 基本代理標頭
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket 支援（如果需要）
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;

        # 超時設定（用於 GIF 生成）
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # 快取靜態資源
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}
EOF

success "設定檔已建立"

# ── 啟用設定 ──────────────────────────────────────────────────────────────────
info "啟用設定..."

# 移除舊的 symbolic link（如果存在）
rm -f /etc/nginx/sites-enabled/girlsbandshot

# 建立新的 symbolic link
ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/girlsbandshot

success "設定已啟用"

# ── 測試設定 ──────────────────────────────────────────────────────────────────
header "測試 Nginx 設定"

if nginx -t; then
  success "Nginx 設定檢查通過"
else
  error "Nginx 設定有誤"
  exit 1
fi

# ── 重啟 Nginx ────────────────────────────────────────────────────────────────
info "重啟 Nginx..."
systemctl restart nginx
systemctl enable nginx
success "Nginx 已重啟並設定為開機自啟"

# ── SSL 設定（可選）──────────────────────────────────────────────────────────
if [ "$USE_DOMAIN" = true ]; then
  echo ""
  read -p "$(echo -e ${BOLD}是否要設定 HTTPS/SSL (Let\'s Encrypt)？[y/N]${NC} )" -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    header "設定 SSL"

    # 安裝 certbot
    if ! command -v certbot &>/dev/null; then
      info "安裝 certbot..."
      apt install -y certbot python3-certbot-nginx
    fi

    # 設定 SSL
    info "開始設定 SSL，請依照提示輸入 email..."
    certbot --nginx -d "$DOMAIN"

    if [ $? -eq 0 ]; then
      success "SSL 設定完成！"
      success "網站已可透過 https://$DOMAIN 存取"
    else
      warn "SSL 設定失敗，請檢查域名 DNS 設定"
    fi
  fi
fi

# ── 完成 ──────────────────────────────────────────────────────────────────────
header "設定完成！"

echo ""
success "Nginx 反向代理已成功設定"
echo ""
echo -e "${BOLD}存取網站：${NC}"

if [ "$USE_DOMAIN" = true ]; then
  echo "  http://$DOMAIN"
  if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "  https://$DOMAIN"
  fi
else
  echo "  http://$SERVER_IP"
fi

echo ""
echo -e "${BOLD}常用指令：${NC}"
echo "  # 檢查 Nginx 狀態"
echo "  sudo systemctl status nginx"
echo ""
echo "  # 查看日誌"
echo "  sudo tail -f /var/log/nginx/girlsbandshot_access.log"
echo "  sudo tail -f /var/log/nginx/girlsbandshot_error.log"
echo ""
echo "  # 重啟 Nginx"
echo "  sudo systemctl restart nginx"
echo ""
echo "  # 測試設定"
echo "  sudo nginx -t"
echo ""

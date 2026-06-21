# Docker 部署指南

## VM 規格建議

### 純搜尋（最低配置）
- **CPU**: 1 vCPU
- **RAM**: 2 GB
- **儲存**: 20 GB

### 含截圖/GIF（推薦配置）
- **CPU**: 2 vCPU
- **RAM**: 4 GB
- **儲存**: 50-100 GB（含影片）

**作業系統**: Ubuntu 22.04 / 24.04 LTS

---

## 快速部署

### 1. 安裝 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 登出後重新登入
```

### 2. Clone 專案

```bash
git clone https://github.com/alaner652/GirlsBandShot
cd GirlsBandShot
```

### 3. 啟動服務

```bash
docker compose up -d
```

完成！開啟 `http://your-server-ip:3000`

---
## 管理指令

```bash
# 查看服務狀態
docker compose ps

# 查看日誌
docker compose logs -f

# 重啟服務
docker compose restart

# 停止服務
docker compose down
```

### 更新專案（保留影片）

```bash
# 使用自動更新腳本（推薦）
./update.sh
```

腳本會自動：
1. ✅ 檢查未提交的變更
2. ✅ 確認影片目錄被保護
3. ✅ 拉取最新代碼（`git pull`）
4. ✅ 重建並重啟容器
5. ✅ 驗證影片檔案完好

**手動更新**：
```bash
git pull
docker compose up -d --build
```

💡 **注意**：影片檔案在 `web/data/*/videos/` 已被 `.gitignore` 排除，執行 `git pull` 時不會被刪除。

---

## 新增影片

影片放到 `web/data/{系列名}/videos/`：

```bash
# 在 VM 上
mkdir -p web/data/ave-mujica/videos

# 從本機上傳
scp video.mp4 user@server:~/GirlsBandShot/web/data/ave-mujica/videos/

# 重啟服務
docker compose restart
```

影片命名：`EP01.mp4`, `EP02.mp4`...

---

## 使用 Nginx 反向代理（可選）

如果需要：
- 使用 80/443 port（不用加 :3000）
- 綁定域名
- 設定 HTTPS/SSL

### 自動設定（推薦）

```bash
# 在 VM 上執行
sudo ./setup-nginx.sh
```

腳本會自動：
1. ✅ 安裝 Nginx
2. ✅ 建立反向代理設定
3. ✅ 詢問是否設定 SSL（Let's Encrypt）
4. ✅ 重啟服務

### 手動設定

<details>
<summary>展開查看手動設定步驟</summary>

```bash
# 1. 安裝 Nginx
sudo apt install -y nginx

# 2. 建立設定檔
sudo nano /etc/nginx/sites-available/girlsbandshot
```

內容：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 或使用 _（任意 IP/域名）

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
```

```bash
# 3. 啟用設定
sudo ln -s /etc/nginx/sites-available/girlsbandshot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 4. 設定 SSL（可選）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
</details>

---

## 疑難排解

### 檢查容器狀態
```bash
docker compose ps
docker compose logs web
```

### 重建容器
```bash
docker compose down
docker compose up -d --build
```

### 清理並重新開始
```bash
docker compose down -v
docker compose up -d
```

### Port 已被佔用
修改 `docker-compose.yml` 中的 port：
```yaml
ports:
  - "8080:3000"  # 改用 8080
```

---

## 費用估算

**VPS 推薦**（月費）：
- Vultr: $6 (2 vCPU, 4GB RAM)
- DigitalOcean: $12 (2 vCPU, 4GB RAM)
- Linode: $12 (2 vCPU, 4GB RAM)

FROM node:22-alpine

# 安裝 ffmpeg（用於截圖/GIF）
RUN apk add --no-cache ffmpeg

WORKDIR /app

# 複製 package files
COPY web/package*.json ./

# 安裝依賴
RUN npm ci --production=false

# 複製專案檔案
COPY web/ .

# 建置
RUN npm run build

# 環境變數
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_BASE=./data

EXPOSE 3000

CMD ["npm", "start"]

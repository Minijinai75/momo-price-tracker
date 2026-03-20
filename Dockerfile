# Dockerfile for Zeabur deployment
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package files
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製應用程式碼
COPY . .

# 建立資料目錄
RUN mkdir -p data

# 啟動應用
CMD ["node", "index.js"]

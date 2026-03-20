# Momo 價格追蹤器

自動追蹤 Momo 購物網商品價格變化，並透過 Telegram 即時通知降價資訊。支援部署到 Zeabur。

## 功能特色

- 🔍 自動追蹤 Momo 商品價格（每天台灣時間 00:30）
- 📉 價格下降即時通知
- 📈 價格上漲提醒（可選）
- 📊 價格歷史記錄
- 🤖 Telegram Bot 互動命令
- 💬 支援即時查詢與管理
- ☁️ 支援 Zeabur 部署
- ⏰ 自動化定時監控

## Telegram Bot 命令

系統支援以下互動命令，讓你可以透過 Telegram 直接管理追蹤商品：

### 基本命令
- `/start` - 啟動 Bot 並查看歡迎訊息
- `/help` - 顯示所有命令說明

### 商品管理
- `/list` - 列出目前追蹤的所有商品
- `/add [商品代碼]` - 新增商品到追蹤清單
  - 範例：`/add 11593255`
- `/remove [商品代碼]` - 從追蹤清單中移除商品
  - 範例：`/remove 11593255`

### 價格查詢
- `/check [商品代碼]` - 即時查詢指定商品的當前價格
  - 範例：`/check 11593255`
- `/checkall` - 立即檢查所有追蹤商品的價格

### 歷史記錄
- `/history [商品代碼] [天數]` - 查看商品的價格歷史記錄
  - 範例：`/history 11593255 7`（查看最近 7 天）
  - 預設顯示最近 30 天
- `/export [商品代碼]` - 匯出商品的完整價格歷史（JSON 格式）
  - 範例：`/export 11593255`

### 系統資訊
- `/status` - 查看系統運作狀態和統計資訊

💡 **提示**：透過命令新增的商品會保存在記憶體中，重啟後會消失。建議將常用商品加入環境變數 `PRODUCT_CODES` 以永久保存。

## 快速開始

### 1. 建立 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 發送 `/newbot` 建立新的 Bot
3. 按照指示設定 Bot 名稱和使用者名稱
4. 複製獲得的 **Bot Token**

### 2. 取得 Chat ID

1. 在 Telegram 中找到 [@userinfobot](https://t.me/userinfobot)
2. 發送任意訊息給它
3. 複製獲得的 **Chat ID**

或者使用以下方法：
1. 先與你的 Bot 對話（發送 `/start`）
2. 訪問 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. 在返回的 JSON 中找到 `chat.id`

### 3. 安裝依賴

```bash
npm install
```

### 4. 設定環境變數

複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 檔案：

```env
# Telegram Bot 設定
TELEGRAM_BOT_TOKEN=你的_Bot_Token
TELEGRAM_CHAT_ID=你的_Chat_ID

# 檢查間隔（cron 格式）
# 預設每天台灣時間 00:30（UTC 16:30）
CHECK_INTERVAL=30 16 * * *

# 要監控的商品代碼（多個用逗號分隔）
# 也可以透過 /add 命令動態新增
PRODUCT_CODES=11593255,12345678

# 是否在啟動時立即檢查
CHECK_ON_START=true

# Zeabur 部署設定（本地開發可忽略）
PORT=3000
WEBHOOK_URL=
```

### 5. 執行

開發模式（自動重啟）：
```bash
npm run dev
```

生產模式：
```bash
npm start
```

## Zeabur 部署

### 方法一：使用 Git

1. 將專案推送到 GitHub
2. 在 [Zeabur](https://zeabur.com) 建立新專案
3. 選擇從 GitHub 匯入
4. 設定環境變數（與 `.env` 相同）
5. 部署

### 方法二：使用 Zeabur CLI

```bash
# 安裝 Zeabur CLI
npm install -g @zeabur/cli

# 登入
zeabur auth login

# 部署
zeabur deploy
```

### Zeabur 環境變數設定

在 Zeabur 控制台中設定以下環境變數：

- `TELEGRAM_BOT_TOKEN`: 你的 Telegram Bot Token（必填）
- `TELEGRAM_CHAT_ID`: 你的 Telegram Chat ID（必填）
- `PRODUCT_CODES`: 要監控的商品代碼（用逗號分隔，可選，也可以用 /add 命令新增）
- `CHECK_INTERVAL`: 檢查間隔（cron 格式，預設 `30 16 * * *`，每天台灣時間 00:30）
- `CHECK_ON_START`: 啟動時是否立即檢查（預設 `true`）
- `WEBHOOK_URL`: Zeabur 會自動設定，無需手動填寫

## 如何找到 Momo 商品代碼

1. 開啟 Momo 商品頁面
2. 查看網址，例如：
   ```
   https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=11593255
   ```
3. `i_code=` 後面的數字就是商品代碼（`11593255`）

## Cron 時間格式說明

格式：`分 時 日 月 星期`（時間為 UTC）

**重要**：由於伺服器使用 UTC 時間，台灣時間（UTC+8）需要減 8 小時。

台灣時間範例：
- `30 16 * * *` - 每天台灣時間 00:30（UTC 16:30）**← 預設值**
- `0 1 * * *` - 每天台灣時間 09:00（UTC 01:00）
- `0 13 * * *` - 每天台灣時間 21:00（UTC 13:00）
- `0 17,21 * * *` - 每天台灣時間 01:00 和 05:00

其他範例：
- `0 * * * *` - 每小時整點檢查
- `0 */2 * * *` - 每 2 小時檢查
- `*/30 * * * *` - 每 30 分鐘檢查

💡 **建議**：Momo 價格通常以天為單位變動，建議每天檢查一次即可，避免過於頻繁的請求。

## 專案結構

```
momo-price-tracker/
├── index.js          # 主程式與 HTTP 伺服器
├── config.js         # 設定管理
├── scraper.js        # 網頁爬蟲
├── telegram.js       # Telegram Bot 與通知
├── commands.js       # Telegram 命令處理器
├── database.js       # 資料儲存
├── package.json      # 專案資訊
├── .env.example      # 環境變數範例
├── .gitignore        # Git 忽略檔案
├── Dockerfile        # Docker 容器設定
├── zeabur.json       # Zeabur 部署設定
└── README.md         # 說明文件
```

## 功能說明

### 價格追蹤

- 自動抓取 Momo 商品頁面
- 智慧解析價格資訊
- 支援多種價格顯示格式
- 記錄價格變化歷史
- 每天台灣時間 00:30 自動檢查

### Telegram Bot 互動

**自動通知**：
1. **新商品追蹤通知** - 開始追蹤新商品時
2. **價格下降通知** - 商品降價時（含降幅百分比）
3. **價格上漲通知** - 商品漲價時
4. **錯誤通知** - 發生錯誤時
5. **系統通知** - 啟動/停止時

**互動命令**：
- 即時查詢商品價格
- 動態新增/移除追蹤商品
- 查看價格歷史記錄
- 匯出價格數據
- 系統狀態監控

使用 `/help` 查看所有可用命令。

### 資料儲存

- 使用 JSON 檔案儲存價格歷史
- 自動保留最近 100 筆記錄
- 支援多商品同時追蹤

## 注意事項

1. **檢查頻率**：Momo 價格通常以天為單位變動，建議每天檢查一次即可（預設台灣時間 00:30）
2. **爬蟲規範**：請遵守網站的 robots.txt 和服務條款
3. **僅供個人使用**：請勿用於商業目的或大量爬取
4. **資料準確性**：價格資訊可能因網頁結構變化而解析失敗
5. **命令動態新增的商品**：透過 `/add` 命令新增的商品在重啟後會消失，建議將常用商品加入 `PRODUCT_CODES` 環境變數

## 故障排除

### 無法取得價格

- 檢查商品代碼是否正確
- 確認商品頁面是否存在
- 網頁結構可能已改變，需要更新選擇器

### Telegram 訊息未收到

- 確認 Bot Token 和 Chat ID 正確
- 確認已與 Bot 對話（發送 `/start`）
- 檢查網路連線

### Zeabur 部署失敗

- 確認所有環境變數都已設定
- 檢查 Node.js 版本（需要 >= 18.0.0）
- 查看 Zeabur 部署日誌

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 支援

如有問題，請在 GitHub 上開啟 Issue。

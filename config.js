require('dotenv').config();

module.exports = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  monitor: {
    // Cron 時間格式 (預設每天台灣時間 00:30 檢查)
    // 格式: 分 時 日 月 星期
    // 台灣時間 00:30 = UTC 16:30 (前一天)，因為台灣是 UTC+8
    // 範例: '30 16 * * *' = 每天台灣時間 00:30
    checkInterval: process.env.CHECK_INTERVAL || '30 16 * * *',
    productCodes: process.env.PRODUCT_CODES?.split(',').map(code => code.trim()) || [],
    checkOnStart: process.env.CHECK_ON_START === 'true',
  },

  server: {
    port: process.env.PORT || 3000,
    // Zeabur 會自動設定 ZEABUR_WEB_URL，我們優先使用它
    webhookUrl: process.env.WEBHOOK_URL || process.env.ZEABUR_WEB_URL || '',
    // 檢測是否在雲端環境運行（Zeabur, Railway, Render 等）
    isCloud: !!(process.env.ZEABUR_WEB_URL || process.env.RAILWAY_STATIC_URL || process.env.RENDER_EXTERNAL_URL || process.env.DYNO || process.env.PORT),
  },

  data: {
    filePath: process.env.DATA_FILE || './data/prices.json',
  },

  momo: {
    baseUrl: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

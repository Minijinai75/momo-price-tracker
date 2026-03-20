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
    webhookUrl: process.env.WEBHOOK_URL, // Zeabur 自動提供的網址
  },

  data: {
    filePath: process.env.DATA_FILE || './data/prices.json',
  },

  momo: {
    baseUrl: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

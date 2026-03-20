const cron = require('node-cron');
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const scraper = require('./scraper');
const telegram = require('./telegram');
const database = require('./database');
const commands = require('./commands');

// Express 伺服器（用於 webhook）
const app = express();
app.use(bodyParser.json());

/**
 * 檢查單一商品的價格變化
 */
async function checkProduct(productCode) {
  try {
    console.log(`[Monitor] 檢查商品: ${productCode}`);

    // 抓取當前商品資訊
    const productInfo = await scraper.fetchProductInfo(productCode);

    if (!productInfo || productInfo.error) {
      throw new Error(productInfo?.error || '無法取得商品資訊');
    }

    // 取得歷史價格
    const lastRecord = await database.getLatestPrice(productCode);

    if (!lastRecord) {
      // 第一次追蹤這個商品
      console.log(`[Monitor] 新商品追蹤: ${productInfo.productName} - NT$ ${productInfo.price}`);
      await database.addPriceRecord(productInfo);
      await telegram.sendNewProductAlert(productInfo);
      return;
    }

    const oldPrice = lastRecord.price;
    const newPrice = productInfo.price;

    // 儲存新的價格記錄
    await database.addPriceRecord(productInfo);

    // 檢查價格是否有變化
    if (newPrice < oldPrice) {
      // 價格下降
      console.log(`[Monitor] 價格下降！${productInfo.productName}: NT$ ${oldPrice} → NT$ ${newPrice}`);
      await telegram.sendPriceDropAlert(productInfo, oldPrice, newPrice);
    } else if (newPrice > oldPrice) {
      // 價格上漲
      console.log(`[Monitor] 價格上漲: ${productInfo.productName}: NT$ ${oldPrice} → NT$ ${newPrice}`);
      await telegram.sendPriceIncreaseAlert(productInfo, oldPrice, newPrice);
    } else {
      // 價格未變
      console.log(`[Monitor] 價格不變: ${productInfo.productName} - NT$ ${newPrice}`);
    }

  } catch (error) {
    console.error(`[Monitor] 檢查商品 ${productCode} 時發生錯誤:`, error.message);
    await telegram.sendErrorAlert(`檢查商品 ${productCode} 失敗: ${error.message}`);
  }
}

/**
 * 檢查所有商品
 */
async function checkAllProducts() {
  console.log('[Monitor] 開始檢查所有商品...');
  const startTime = Date.now();

  const productCodes = config.monitor.productCodes;

  if (productCodes.length === 0) {
    console.log('[Monitor] 沒有設定要監控的商品');
    return;
  }

  for (const code of productCodes) {
    await checkProduct(code);

    // 在檢查商品之間加入延遲
    if (productCodes.indexOf(code) < productCodes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Monitor] 檢查完成，耗時 ${elapsed} 秒`);
}

/**
 * 啟動監控系統
 */
async function start() {
  console.log('='.repeat(50));
  console.log('🚀 Momo 價格追蹤器啟動');
  console.log('='.repeat(50));
  console.log(`監控商品數量: ${config.monitor.productCodes.length}`);
  console.log(`檢查間隔: ${config.monitor.checkInterval} (每天台灣時間 00:30)`);
  console.log(`商品代碼: ${config.monitor.productCodes.join(', ')}`);
  console.log('='.repeat(50));

  // 驗證設定
  if (!config.telegram.botToken || !config.telegram.chatId) {
    console.error('❌ 錯誤: 未設定 Telegram Bot 資訊');
    console.error('請在 .env 檔案中設定 TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID');
    process.exit(1);
  }

  if (config.monitor.productCodes.length === 0) {
    console.warn('⚠️  警告: 未設定要監控的商品');
    console.warn('你可以透過 Telegram Bot 命令 /add 來新增商品');
  }

  // 判斷是否使用 webhook 模式
  const useWebhook = !!config.server.webhookUrl;

  // 初始化 Telegram Bot
  const bot = telegram.initBot(useWebhook);

  if (!bot) {
    console.error('❌ Telegram Bot 初始化失敗');
    process.exit(1);
  }

  // 設定 Telegram 命令處理器
  if (useWebhook) {
    // Webhook 模式（Zeabur 部署）
    app.post('/telegram-webhook', (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });

    // 健康檢查端點
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        productsCount: config.monitor.productCodes.length,
        timestamp: new Date().toISOString(),
      });
    });

    // 啟動 HTTP 伺服器
    app.listen(config.server.port, () => {
      console.log(`[Server] HTTP 伺服器已啟動於端口 ${config.server.port}`);
      console.log(`[Server] Webhook URL: ${config.server.webhookUrl}/telegram-webhook`);
    });
  } else {
    // Polling 模式（本地開發）
    console.log('[Telegram] 使用 Polling 模式監聽命令');
  }

  // 註冊命令處理器
  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) {
      await commands.handleCommand(bot, msg, checkAllProducts);
    }
  });

  console.log('[Telegram] 命令系統已啟動');

  // 啟動時立即檢查（如果啟用）
  if (config.monitor.checkOnStart && config.monitor.productCodes.length > 0) {
    console.log('[Monitor] 執行初始檢查...');
    await checkAllProducts();
  }

  // 設定定時任務
  if (config.monitor.productCodes.length > 0) {
    console.log(`[Monitor] 設定定時任務: ${config.monitor.checkInterval} (每天台灣時間 00:30)`);
    cron.schedule(config.monitor.checkInterval, async () => {
      console.log(`[Monitor] 定時檢查觸發 - ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
      await checkAllProducts();
    });
  }

  console.log('✅ 監控系統已啟動，按 Ctrl+C 停止');
  console.log('💡 使用 Telegram 命令 /help 查看所有可用命令');

  // 發送啟動通知
  try {
    let startMessage = `✅ <b>Momo 價格追蹤器已啟動</b>\n\n`;
    startMessage += `📦 監控商品數量: ${config.monitor.productCodes.length}\n`;
    startMessage += `⏰ 檢查時間: 每天台灣時間 00:30\n`;
    startMessage += `🕐 啟動時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n\n`;
    startMessage += `💡 使用 /help 查看所有可用命令`;

    await telegram.sendMessage(startMessage);
  } catch (error) {
    console.error('[Monitor] 發送啟動通知失敗:', error.message);
  }
}

// 處理程序終止
process.on('SIGINT', async () => {
  console.log('\n[Monitor] 收到停止信號，正在關閉...');
  try {
    await telegram.sendMessage(
      `⏹️ <b>Momo 價格追蹤器已停止</b>\n\n` +
      `🕐 停止時間: ${new Date().toLocaleString('zh-TW')}`
    );
  } catch (error) {
    console.error('[Monitor] 發送停止通知失敗:', error.message);
  }
  process.exit(0);
});

// 處理未捕獲的錯誤
process.on('unhandledRejection', (error) => {
  console.error('[Monitor] 未處理的 Promise 錯誤:', error);
});

// 啟動應用程式
start().catch(error => {
  console.error('[Monitor] 啟動失敗:', error);
  process.exit(1);
});

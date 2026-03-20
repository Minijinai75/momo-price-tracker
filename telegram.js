const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

let bot = null;

/**
 * 初始化 Telegram Bot
 * @param {boolean} enableWebhook - 是否啟用 webhook 模式（Zeabur 部署時使用）
 */
function initBot(enableWebhook = false) {
  if (!config.telegram.botToken) {
    console.error('[Telegram] 未設定 TELEGRAM_BOT_TOKEN');
    return null;
  }

  if (!bot) {
    // 雲端環境必須使用 webhook 模式，避免多實例衝突
    const isCloudEnvironment = config.server.isCloud;
    const hasWebhookUrl = !!config.server.webhookUrl;

    if (isCloudEnvironment) {
      // 雲端環境：使用 webhook 模式
      bot = new TelegramBot(config.telegram.botToken);

      if (hasWebhookUrl) {
        const webhookPath = `/telegram-webhook`;
        bot.setWebHook(`${config.server.webhookUrl}${webhookPath}`);
        console.log(`[Telegram] Bot 已初始化 (Webhook 模式): ${config.server.webhookUrl}${webhookPath}`);
      } else {
        // 雲端環境但沒有 webhook URL，先清除之前的 webhook，然後等待設定
        bot.deleteWebHook();
        console.log('[Telegram] Bot 已初始化 (雲端模式，等待 webhook 設定)');
        console.log('[Telegram] 請在環境變數中設定 WEBHOOK_URL 或確保 ZEABUR_WEB_URL 可用');
      }
    } else {
      // 本地環境：使用 polling 模式
      bot = new TelegramBot(config.telegram.botToken, { polling: true });
      console.log('[Telegram] Bot 已初始化 (Polling 模式)');
    }
  }

  return bot;
}

/**
 * 取得 Bot 實例
 */
function getBot() {
  if (!bot) {
    return initBot();
  }
  return bot;
}

/**
 * 發送純文字訊息
 */
async function sendMessage(message) {
  try {
    const botInstance = initBot();
    if (!botInstance) {
      throw new Error('Telegram Bot 未初始化');
    }

    if (!config.telegram.chatId) {
      throw new Error('未設定 TELEGRAM_CHAT_ID');
    }

    await botInstance.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });

    console.log('[Telegram] 訊息已發送');
  } catch (error) {
    console.error('[Telegram] 發送訊息失敗:', error.message);
    throw error;
  }
}

/**
 * 發送價格下降通知
 */
async function sendPriceDropAlert(productInfo, oldPrice, newPrice) {
  const priceChange = oldPrice - newPrice;
  const percentChange = ((priceChange / oldPrice) * 100).toFixed(2);

  const message = `
🔔 <b>價格下降通知！</b>

📦 <b>商品：</b>${productInfo.productName}

💰 <b>價格變化：</b>
   舊價格：NT$ ${oldPrice.toLocaleString()}
   新價格：NT$ ${newPrice.toLocaleString()}

📉 <b>降價：</b>NT$ ${priceChange.toLocaleString()} (-${percentChange}%)

🔗 <a href="${productInfo.url}">查看商品</a>

⏰ 更新時間：${new Date(productInfo.timestamp).toLocaleString('zh-TW')}
  `.trim();

  await sendMessage(message);
}

/**
 * 發送價格上漲通知
 */
async function sendPriceIncreaseAlert(productInfo, oldPrice, newPrice) {
  const priceChange = newPrice - oldPrice;
  const percentChange = ((priceChange / oldPrice) * 100).toFixed(2);

  const message = `
📈 <b>價格上漲通知</b>

📦 <b>商品：</b>${productInfo.productName}

💰 <b>價格變化：</b>
   舊價格：NT$ ${oldPrice.toLocaleString()}
   新價格：NT$ ${newPrice.toLocaleString()}

📈 <b>漲價：</b>NT$ ${priceChange.toLocaleString()} (+${percentChange}%)

🔗 <a href="${productInfo.url}">查看商品</a>

⏰ 更新時間：${new Date(productInfo.timestamp).toLocaleString('zh-TW')}
  `.trim();

  await sendMessage(message);
}

/**
 * 發送新商品追蹤通知
 */
async function sendNewProductAlert(productInfo) {
  const message = `
✅ <b>開始追蹤新商品</b>

📦 <b>商品：</b>${productInfo.productName}

💰 <b>當前價格：</b>NT$ ${productInfo.price.toLocaleString()}

🔗 <a href="${productInfo.url}">查看商品</a>

⏰ 開始時間：${new Date(productInfo.timestamp).toLocaleString('zh-TW')}
  `.trim();

  await sendMessage(message);
}

/**
 * 發送每日摘要報告
 */
async function sendDailySummary(products) {
  let message = '<b>📊 每日價格摘要</b>\n\n';

  products.forEach((product, index) => {
    message += `${index + 1}. <b>${product.productName}</b>\n`;
    message += `   💰 當前價格：NT$ ${product.price.toLocaleString()}\n`;

    if (product.priceChange) {
      const emoji = product.priceChange > 0 ? '📈' : '📉';
      message += `   ${emoji} 變化：NT$ ${Math.abs(product.priceChange).toLocaleString()}\n`;
    }

    message += `   🔗 <a href="${product.url}">查看商品</a>\n\n`;
  });

  message += `⏰ 更新時間：${new Date().toLocaleString('zh-TW')}`;

  await sendMessage(message);
}

/**
 * 發送錯誤通知
 */
async function sendErrorAlert(errorMessage) {
  const message = `
❌ <b>監控系統錯誤</b>

🔴 <b>錯誤訊息：</b>
${errorMessage}

⏰ 發生時間：${new Date().toLocaleString('zh-TW')}
  `.trim();

  await sendMessage(message);
}

module.exports = {
  initBot,
  getBot,
  sendMessage,
  sendPriceDropAlert,
  sendPriceIncreaseAlert,
  sendNewProductAlert,
  sendDailySummary,
  sendErrorAlert,
};

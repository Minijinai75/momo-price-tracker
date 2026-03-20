const config = require('./config');
const scraper = require('./scraper');
const database = require('./database');

/**
 * Telegram Bot 命令處理器
 */

/**
 * /start - 啟動 Bot
 */
async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const message = `
👋 <b>歡迎使用 Momo 價格追蹤器！</b>

我可以幫你追蹤 Momo 購物網的商品價格，當價格變動時會自動通知你。

📋 <b>可用命令：</b>

/help - 查看所有命令說明
/list - 查看目前追蹤的商品
/add [商品代碼] - 新增追蹤商品
/remove [商品代碼] - 移除追蹤商品
/check [商品代碼] - 即時查詢商品價格
/checkall - 立即檢查所有商品
/history [商品代碼] - 查看商品價格歷史
/status - 查看系統狀態

💡 <b>使用範例：</b>
• 新增追蹤：<code>/add 11593255</code>
• 查詢價格：<code>/check 11593255</code>

🔍 <b>如何取得商品代碼？</b>
從 Momo 商品網址中的 <code>i_code=</code> 後面的數字
例如：<code>i_code=11593255</code>
  `.trim();

  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
}

/**
 * /help - 顯示幫助訊息
 */
async function handleHelp(bot, msg) {
  const chatId = msg.chat.id;
  const message = `
📚 <b>命令說明</b>

<b>/start</b>
啟動 Bot 並查看歡迎訊息

<b>/help</b>
顯示此幫助訊息

<b>/list</b>
列出目前所有追蹤中的商品

<b>/add [商品代碼]</b>
新增商品到追蹤清單
範例：<code>/add 11593255</code>

<b>/remove [商品代碼]</b>
從追蹤清單中移除商品
範例：<code>/remove 11593255</code>

<b>/check [商品代碼]</b>
即時查詢指定商品的當前價格
範例：<code>/check 11593255</code>

<b>/checkall</b>
立即檢查所有追蹤商品的價格

<b>/history [商品代碼] [天數]</b>
查看商品的價格歷史記錄
範例：<code>/history 11593255 7</code>（查看最近 7 天）
預設顯示最近 30 天

<b>/status</b>
查看系統運作狀態和統計資訊

<b>/export [商品代碼]</b>
匯出商品的完整價格歷史（JSON 格式）

💡 <b>提示：</b>
• 商品代碼可以從 Momo 網址的 i_code 參數取得
• 系統每天台灣時間 00:30 自動檢查價格
• 價格變動時會自動發送通知
  `.trim();

  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
}

/**
 * /list - 列出追蹤的商品
 */
async function handleList(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const products = config.monitor.productCodes;

    if (products.length === 0) {
      await bot.sendMessage(
        chatId,
        '📭 目前沒有追蹤任何商品\n\n使用 /add [商品代碼] 來新增商品',
        { parse_mode: 'HTML' }
      );
      return;
    }

    let message = `📦 <b>目前追蹤的商品 (${products.length})</b>\n\n`;

    for (const code of products) {
      const latestPrice = await database.getLatestPrice(code);

      if (latestPrice) {
        const priceHistory = await database.getPriceHistory(code, 2);
        let changeInfo = '';

        if (priceHistory.length >= 2) {
          const priceDiff = latestPrice.price - priceHistory[1].price;
          if (priceDiff < 0) {
            changeInfo = ` 📉 -NT$ ${Math.abs(priceDiff).toLocaleString()}`;
          } else if (priceDiff > 0) {
            changeInfo = ` 📈 +NT$ ${priceDiff.toLocaleString()}`;
          }
        }

        message += `${products.indexOf(code) + 1}. <b>${latestPrice.productName}</b>\n`;
        message += `   💰 NT$ ${latestPrice.price.toLocaleString()}${changeInfo}\n`;
        message += `   🔢 代碼: <code>${code}</code>\n`;
        message += `   🔗 <a href="${latestPrice.url}">查看商品</a>\n\n`;
      } else {
        message += `${products.indexOf(code) + 1}. 商品代碼: <code>${code}</code>\n`;
        message += `   ⚠️ 尚未取得價格資訊\n\n`;
      }
    }

    message += `⏰ 下次檢查: 每天台灣時間 00:30`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (error) {
    console.error('[Commands] /list 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 取得商品清單失敗: ${error.message}`);
  }
}

/**
 * /add - 新增追蹤商品
 */
async function handleAdd(bot, msg, productCode) {
  const chatId = msg.chat.id;

  if (!productCode) {
    await bot.sendMessage(
      chatId,
      '❌ 請提供商品代碼\n\n使用方式：<code>/add 11593255</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 驗證商品代碼格式
  if (!/^\d+$/.test(productCode)) {
    await bot.sendMessage(chatId, '❌ 商品代碼格式錯誤，應該是純數字');
    return;
  }

  try {
    // 檢查是否已經在追蹤清單中
    if (config.monitor.productCodes.includes(productCode)) {
      await bot.sendMessage(chatId, `⚠️ 商品 ${productCode} 已經在追蹤清單中`);
      return;
    }

    await bot.sendMessage(chatId, '🔍 正在查詢商品資訊...');

    // 嘗試抓取商品資訊
    const productInfo = await scraper.fetchProductInfo(productCode);

    if (!productInfo || productInfo.error) {
      await bot.sendMessage(
        chatId,
        `❌ 無法取得商品資訊: ${productInfo?.error || '商品不存在'}`
      );
      return;
    }

    // 新增到設定檔（這裡只是新增到記憶體，實際上應該寫入環境變數或資料庫）
    config.monitor.productCodes.push(productCode);

    // 儲存初始價格
    await database.addPriceRecord(productInfo);

    const message = `
✅ <b>已新增商品到追蹤清單</b>

📦 <b>商品：</b>${productInfo.productName}

💰 <b>當前價格：</b>NT$ ${productInfo.price.toLocaleString()}

🔢 <b>商品代碼：</b><code>${productCode}</code>

🔗 <a href="${productInfo.url}">查看商品</a>

⏰ <b>監控說明：</b>
• 系統會在每天台灣時間 00:30 自動檢查價格
• 價格變動時會自動通知你

💡 <b>提示：</b>記得將商品代碼加入環境變數 PRODUCT_CODES 以永久保存
    `.trim();

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
  } catch (error) {
    console.error('[Commands] /add 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 新增商品失敗: ${error.message}`);
  }
}

/**
 * /remove - 移除追蹤商品
 */
async function handleRemove(bot, msg, productCode) {
  const chatId = msg.chat.id;

  if (!productCode) {
    await bot.sendMessage(
      chatId,
      '❌ 請提供商品代碼\n\n使用方式：<code>/remove 11593255</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  try {
    const index = config.monitor.productCodes.indexOf(productCode);

    if (index === -1) {
      await bot.sendMessage(chatId, `⚠️ 商品 ${productCode} 不在追蹤清單中`);
      return;
    }

    // 取得商品資訊
    const latestPrice = await database.getLatestPrice(productCode);
    const productName = latestPrice ? latestPrice.productName : `商品 ${productCode}`;

    // 從清單中移除
    config.monitor.productCodes.splice(index, 1);

    await bot.sendMessage(
      chatId,
      `✅ 已移除商品：<b>${productName}</b>\n\n💡 提示：記得從環境變數 PRODUCT_CODES 中移除此商品代碼`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[Commands] /remove 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 移除商品失敗: ${error.message}`);
  }
}

/**
 * /check - 即時查詢商品價格
 */
async function handleCheck(bot, msg, productCode) {
  const chatId = msg.chat.id;

  if (!productCode) {
    await bot.sendMessage(
      chatId,
      '❌ 請提供商品代碼\n\n使用方式：<code>/check 11593255</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  try {
    await bot.sendMessage(chatId, '🔍 正在查詢商品價格...');

    const productInfo = await scraper.fetchProductInfo(productCode);

    if (!productInfo || productInfo.error) {
      await bot.sendMessage(
        chatId,
        `❌ 無法取得商品資訊: ${productInfo?.error || '商品不存在'}`
      );
      return;
    }

    // 取得歷史價格比較
    const latestRecord = await database.getLatestPrice(productCode);
    let priceChangeInfo = '';

    if (latestRecord) {
      const priceDiff = productInfo.price - latestRecord.price;
      const daysDiff = Math.floor(
        (new Date(productInfo.timestamp) - new Date(latestRecord.timestamp)) / (1000 * 60 * 60 * 24)
      );

      if (priceDiff !== 0 && daysDiff > 0) {
        const emoji = priceDiff < 0 ? '📉' : '📈';
        const sign = priceDiff < 0 ? '-' : '+';
        priceChangeInfo = `\n\n${emoji} <b>價格變化：</b>${sign}NT$ ${Math.abs(priceDiff).toLocaleString()} (${daysDiff} 天前)`;
      }
    }

    const message = `
🔍 <b>商品價格查詢</b>

📦 <b>商品：</b>${productInfo.productName}

💰 <b>當前價格：</b>NT$ ${productInfo.price.toLocaleString()}${priceChangeInfo}

🔗 <a href="${productInfo.url}">查看商品</a>

⏰ 查詢時間：${new Date(productInfo.timestamp).toLocaleString('zh-TW')}
    `.trim();

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
  } catch (error) {
    console.error('[Commands] /check 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 查詢商品失敗: ${error.message}`);
  }
}

/**
 * /checkall - 檢查所有商品
 */
async function handleCheckAll(bot, msg, checkAllProductsFunc) {
  const chatId = msg.chat.id;

  try {
    const products = config.monitor.productCodes;

    if (products.length === 0) {
      await bot.sendMessage(chatId, '📭 目前沒有追蹤任何商品');
      return;
    }

    await bot.sendMessage(chatId, `🔄 開始檢查 ${products.length} 個商品...`);

    // 執行檢查
    await checkAllProductsFunc();

    await bot.sendMessage(
      chatId,
      `✅ 檢查完成！已檢查 ${products.length} 個商品\n如有價格變動會自動發送通知`
    );
  } catch (error) {
    console.error('[Commands] /checkall 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 檢查失敗: ${error.message}`);
  }
}

/**
 * /history - 查看價格歷史
 */
async function handleHistory(bot, msg, args) {
  const chatId = msg.chat.id;
  const productCode = args[0];
  const days = parseInt(args[1]) || 30;

  if (!productCode) {
    await bot.sendMessage(
      chatId,
      '❌ 請提供商品代碼\n\n使用方式：<code>/history 11593255 [天數]</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  try {
    const history = await database.getPriceHistory(productCode, days);

    if (history.length === 0) {
      await bot.sendMessage(chatId, `📭 找不到商品 ${productCode} 的價格記錄`);
      return;
    }

    const productName = history[0].productName;
    const currentPrice = history[0].price;
    const oldestPrice = history[history.length - 1].price;
    const priceDiff = currentPrice - oldestPrice;
    const percentChange = ((priceDiff / oldestPrice) * 100).toFixed(2);

    let message = `📊 <b>${productName}</b>\n\n`;
    message += `💰 <b>當前價格：</b>NT$ ${currentPrice.toLocaleString()}\n`;
    message += `📅 <b>記錄期間：</b>最近 ${history.length} 筆記錄\n\n`;

    if (priceDiff !== 0) {
      const emoji = priceDiff < 0 ? '📉' : '📈';
      const sign = priceDiff < 0 ? '-' : '+';
      message += `${emoji} <b>價格變化：</b>${sign}NT$ ${Math.abs(priceDiff).toLocaleString()} (${sign}${Math.abs(percentChange)}%)\n\n`;
    } else {
      message += `📊 價格保持穩定\n\n`;
    }

    message += `<b>最近價格記錄：</b>\n`;

    // 只顯示最近 10 筆記錄
    const recentHistory = history.slice(0, 10);
    recentHistory.forEach((record, index) => {
      const date = new Date(record.timestamp).toLocaleDateString('zh-TW');
      const priceChange = index < history.length - 1 ? record.price - history[index + 1].price : 0;
      const changeEmoji = priceChange < 0 ? '📉' : priceChange > 0 ? '📈' : '➖';

      message += `${changeEmoji} ${date} - NT$ ${record.price.toLocaleString()}`;
      if (priceChange !== 0) {
        message += ` (${priceChange > 0 ? '+' : ''}${priceChange.toLocaleString()})`;
      }
      message += '\n';
    });

    if (history.length > 10) {
      message += `\n... 還有 ${history.length - 10} 筆記錄\n`;
      message += `使用 /export ${productCode} 匯出完整記錄`;
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Commands] /history 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 查詢歷史失敗: ${error.message}`);
  }
}

/**
 * /status - 系統狀態
 */
async function handleStatus(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const products = config.monitor.productCodes;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    let message = `📊 <b>系統狀態</b>\n\n`;
    message += `✅ <b>運作狀態：</b>正常運行\n`;
    message += `⏱️ <b>運行時間：</b>${hours} 小時 ${minutes} 分鐘\n`;
    message += `📦 <b>追蹤商品：</b>${products.length} 個\n`;
    message += `⏰ <b>檢查間隔：</b>每天台灣時間 00:30\n`;
    message += `💾 <b>記憶體使用：</b>${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n\n`;

    // 統計資訊
    let totalRecords = 0;
    for (const code of products) {
      const history = await database.getPriceHistory(code);
      totalRecords += history.length;
    }

    message += `📈 <b>統計資訊：</b>\n`;
    message += `   • 總價格記錄：${totalRecords} 筆\n`;
    message += `   • 平均每商品：${products.length > 0 ? (totalRecords / products.length).toFixed(1) : 0} 筆\n\n`;

    message += `🕐 <b>當前時間：</b>${new Date().toLocaleString('zh-TW')}`;

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Commands] /status 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 取得狀態失敗: ${error.message}`);
  }
}

/**
 * /export - 匯出價格歷史
 */
async function handleExport(bot, msg, productCode) {
  const chatId = msg.chat.id;

  if (!productCode) {
    await bot.sendMessage(
      chatId,
      '❌ 請提供商品代碼\n\n使用方式：<code>/export 11593255</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  try {
    const history = await database.getPriceHistory(productCode);

    if (history.length === 0) {
      await bot.sendMessage(chatId, `📭 找不到商品 ${productCode} 的價格記錄`);
      return;
    }

    const exportData = {
      productCode,
      productName: history[0].productName,
      exportTime: new Date().toISOString(),
      totalRecords: history.length,
      priceHistory: history.map(record => ({
        date: new Date(record.timestamp).toISOString(),
        price: record.price,
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');

    await bot.sendDocument(
      chatId,
      buffer,
      {},
      {
        filename: `momo_${productCode}_${new Date().toISOString().split('T')[0]}.json`,
        contentType: 'application/json',
      }
    );

    await bot.sendMessage(
      chatId,
      `✅ 已匯出 ${history[0].productName} 的 ${history.length} 筆價格記錄`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[Commands] /export 錯誤:', error);
    await bot.sendMessage(chatId, `❌ 匯出失敗: ${error.message}`);
  }
}

/**
 * 命令路由器
 */
async function handleCommand(bot, msg, checkAllProductsFunc) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const command = text.split(' ')[0].toLowerCase();
  const args = text.split(' ').slice(1);

  console.log(`[Commands] 收到命令: ${command} from ${chatId}`);

  // 驗證 Chat ID（可選）
  if (config.telegram.chatId && chatId.toString() !== config.telegram.chatId) {
    console.log(`[Commands] 未授權的 Chat ID: ${chatId}`);
    await bot.sendMessage(chatId, '❌ 你沒有權限使用此 Bot');
    return;
  }

  switch (command) {
    case '/start':
      await handleStart(bot, msg);
      break;
    case '/help':
      await handleHelp(bot, msg);
      break;
    case '/list':
      await handleList(bot, msg);
      break;
    case '/add':
      await handleAdd(bot, msg, args[0]);
      break;
    case '/remove':
      await handleRemove(bot, msg, args[0]);
      break;
    case '/check':
      await handleCheck(bot, msg, args[0]);
      break;
    case '/checkall':
      await handleCheckAll(bot, msg, checkAllProductsFunc);
      break;
    case '/history':
      await handleHistory(bot, msg, args);
      break;
    case '/status':
      await handleStatus(bot, msg);
      break;
    case '/export':
      await handleExport(bot, msg, args[0]);
      break;
    default:
      await bot.sendMessage(
        chatId,
        '❌ 未知的命令\n\n使用 /help 查看所有可用命令',
        { parse_mode: 'HTML' }
      );
  }
}

module.exports = {
  handleCommand,
};

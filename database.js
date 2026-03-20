const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

/**
 * 確保資料目錄存在
 */
async function ensureDataDir() {
  const dir = path.dirname(config.data.filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * 讀取價格歷史資料
 */
async function loadPriceHistory() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(config.data.filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 檔案不存在，返回空物件
      return {};
    }
    console.error('[Database] 讀取價格歷史失敗:', error.message);
    return {};
  }
}

/**
 * 儲存價格歷史資料
 */
async function savePriceHistory(history) {
  try {
    await ensureDataDir();
    await fs.writeFile(
      config.data.filePath,
      JSON.stringify(history, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('[Database] 儲存價格歷史失敗:', error.message);
    throw error;
  }
}

/**
 * 取得指定商品的最新價格記錄
 */
async function getLatestPrice(productCode) {
  const history = await loadPriceHistory();
  const productHistory = history[productCode];

  if (!productHistory || productHistory.length === 0) {
    return null;
  }

  // 返回最新的價格記錄
  return productHistory[productHistory.length - 1];
}

/**
 * 新增價格記錄
 */
async function addPriceRecord(productInfo) {
  const history = await loadPriceHistory();

  if (!history[productInfo.productCode]) {
    history[productInfo.productCode] = [];
  }

  // 新增記錄
  history[productInfo.productCode].push({
    price: productInfo.price,
    productName: productInfo.productName,
    timestamp: productInfo.timestamp,
  });

  // 只保留最近 100 筆記錄（避免檔案過大）
  if (history[productInfo.productCode].length > 100) {
    history[productInfo.productCode] = history[productInfo.productCode].slice(-100);
  }

  await savePriceHistory(history);

  console.log(`[Database] 已儲存商品 ${productInfo.productCode} 的價格記錄: NT$ ${productInfo.price}`);
}

/**
 * 取得商品的價格歷史（最近 N 筆）
 */
async function getPriceHistory(productCode, limit = 10) {
  const history = await loadPriceHistory();
  const productHistory = history[productCode] || [];

  return productHistory.slice(-limit);
}

/**
 * 取得所有追蹤的商品代碼
 */
async function getAllTrackedProducts() {
  const history = await loadPriceHistory();
  return Object.keys(history);
}

/**
 * 刪除商品的價格歷史
 */
async function deleteProductHistory(productCode) {
  const history = await loadPriceHistory();

  if (history[productCode]) {
    delete history[productCode];
    await savePriceHistory(history);
    console.log(`[Database] 已刪除商品 ${productCode} 的價格歷史`);
    return true;
  }

  return false;
}

module.exports = {
  loadPriceHistory,
  savePriceHistory,
  getLatestPrice,
  addPriceRecord,
  getPriceHistory,
  getAllTrackedProducts,
  deleteProductHistory,
};

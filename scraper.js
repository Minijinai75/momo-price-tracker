const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');

/**
 * 延遲函數，避免請求過於頻繁
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 方法一：使用 Momo 手機版 API 抓取商品資訊（更快更穩定）
 */
async function fetchFromMobileApi(productCode) {
  const apiUrl = `https://m.momoshop.com.tw/goods.momo?i_code=${productCode}&mdiv=searchEngine`;

  const response = await axios.get(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    timeout: 30000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(response.data);

  // 手機版價格選擇器
  let price = null;
  const priceSelectors = [
    '.prdPrice',
    '.goodsPrice',
    '.price',
    '#memPrice',
    '[class*="Price"]',
    '[class*="price"]',
  ];

  for (const selector of priceSelectors) {
    const priceText = $(selector).first().text().trim();
    if (priceText) {
      const priceMatch = priceText.match(/[\d,]+/);
      if (priceMatch) {
        price = parseInt(priceMatch[0].replace(/,/g, ''));
        if (price > 0) break;
      }
    }
  }

  // 商品名稱
  let productName = $('meta[property="og:title"]').attr('content') ||
                    $('title').text().trim() ||
                    $('.prdName').first().text().trim() ||
                    `商品 ${productCode}`;

  // 清理商品名稱
  productName = productName.replace(/\s*-\s*momo購物網$/, '').trim();

  if (!price) {
    // 嘗試從 script 中提取價格
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || '';
      const priceMatch = content.match(/["\']?price["\']?\s*[:=]\s*["\']?(\d+)/i);
      if (priceMatch) {
        price = parseInt(priceMatch[1]);
        if (price > 0) break;
      }
    }
  }

  return { price, productName };
}

/**
 * 方法二：使用桌面版網頁抓取（備用方案）
 */
async function fetchFromDesktop(productCode) {
  const url = `${config.momo.baseUrl}?i_code=${productCode}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    },
    timeout: 45000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(response.data);

  let price = null;
  const priceSelectors = ['.prdPrice', '.price', '#memPrice', '.showPrice', '[class*="price"]'];

  for (const selector of priceSelectors) {
    const priceText = $(selector).first().text().trim();
    if (priceText) {
      const priceMatch = priceText.match(/[\d,]+/);
      if (priceMatch) {
        price = parseInt(priceMatch[0].replace(/,/g, ''));
        if (price > 0) break;
      }
    }
  }

  let productName = $('meta[property="og:title"]').attr('content') ||
                    $('h1.prdName').first().text().trim() ||
                    $('title').text().trim() ||
                    `商品 ${productCode}`;

  // 嘗試從 JSON-LD 獲取價格
  if (!price) {
    const jsonLdScript = $('script[type="application/ld+json"]').html();
    if (jsonLdScript) {
      try {
        const jsonData = JSON.parse(jsonLdScript);
        if (jsonData.offers && jsonData.offers.price) {
          price = parseInt(jsonData.offers.price);
        }
      } catch (e) {
        // 忽略解析錯誤
      }
    }
  }

  return { price, productName };
}

/**
 * 抓取 Momo 商品資訊（優先使用手機版 API，失敗則使用桌面版）
 * @param {string} productCode - 商品代碼
 * @returns {Promise<Object>} 商品資訊
 */
async function fetchProductInfo(productCode) {
  const maxRetries = 3;
  let lastError;
  const url = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${productCode}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Scraper] 抓取商品: ${productCode} (嘗試 ${attempt}/${maxRetries})`);

      let price = null;
      let productName = null;

      // 第一次嘗試：手機版 API
      try {
        console.log(`[Scraper] 嘗試手機版 API...`);
        const mobileResult = await fetchFromMobileApi(productCode);
        price = mobileResult.price;
        productName = mobileResult.productName;
      } catch (mobileError) {
        console.log(`[Scraper] 手機版 API 失敗: ${mobileError.message}，嘗試桌面版...`);
      }

      // 如果手機版失敗，嘗試桌面版
      if (!price) {
        const desktopResult = await fetchFromDesktop(productCode);
        price = desktopResult.price;
        productName = desktopResult.productName || productName;
      }

      if (!price) {
        throw new Error('無法找到商品價格');
      }

      return {
        productCode,
        productName: productName || `商品 ${productCode}`,
        price,
        url,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      lastError = error;
      console.error(`[Scraper] 嘗試 ${attempt}/${maxRetries} 失敗:`, error.message);

      if (attempt < maxRetries) {
        const waitTime = attempt * 3000;
        console.log(`[Scraper] 等待 ${waitTime / 1000} 秒後重試...`);
        await delay(waitTime);
      }
    }
  }

  console.error(`[Scraper] 抓取商品 ${productCode} 失敗，已重試 ${maxRetries} 次`);
  throw lastError;
}

/**
 * 抓取多個商品資訊
 * @param {string[]} productCodes - 商品代碼陣列
 * @returns {Promise<Object[]>} 商品資訊陣列
 */
async function fetchMultipleProducts(productCodes) {
  const results = [];

  for (const code of productCodes) {
    try {
      const info = await fetchProductInfo(code);
      results.push(info);

      // 在請求之間添加延遲，避免被封鎖
      if (productCodes.indexOf(code) < productCodes.length - 1) {
        await delay(2000); // 延遲 2 秒
      }
    } catch (error) {
      console.error(`[Scraper] 商品 ${code} 處理失敗，繼續下一個`);
      results.push({
        productCode: code,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

module.exports = {
  fetchProductInfo,
  fetchMultipleProducts,
};

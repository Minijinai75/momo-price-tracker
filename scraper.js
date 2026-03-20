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
 * 抓取 Momo 商品資訊
 * @param {string} productCode - 商品代碼
 * @returns {Promise<Object>} 商品資訊
 */
async function fetchProductInfo(productCode) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `${config.momo.baseUrl}?i_code=${productCode}`;

      console.log(`[Scraper] 抓取商品: ${productCode} (嘗試 ${attempt}/${maxRetries})`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 60000, // 增加到 60 秒
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);

    // 嘗試多種可能的價格選擇器
    let price = null;
    const priceSelectors = [
      '.prdPrice',
      '.price',
      '#memPrice',
      '.showPrice',
      '[class*="price"]',
    ];

    for (const selector of priceSelectors) {
      const priceText = $(selector).first().text().trim();
      if (priceText) {
        // 移除非數字字符，只保留數字
        const priceMatch = priceText.match(/[\d,]+/);
        if (priceMatch) {
          price = parseInt(priceMatch[0].replace(/,/g, ''));
          if (price > 0) break;
        }
      }
    }

    // 嘗試多種可能的商品名稱選擇器
    let productName = null;
    const nameSelectors = [
      'h1.prdName',
      '.goodsName',
      'h1',
      '[class*="productName"]',
      '[class*="goodsName"]',
    ];

    for (const selector of nameSelectors) {
      const name = $(selector).first().text().trim();
      if (name && name.length > 0 && name.length < 200) {
        productName = name;
        break;
      }
    }

    // 從 meta 標籤獲取信息作為後備方案
    if (!productName) {
      productName = $('meta[property="og:title"]').attr('content') ||
                    $('meta[name="title"]').attr('content') ||
                    `商品 ${productCode}`;
    }

    if (!price) {
      // 嘗試從 JSON-LD 結構化數據中獲取價格
      const jsonLdScript = $('script[type="application/ld+json"]').html();
      if (jsonLdScript) {
        try {
          const jsonData = JSON.parse(jsonLdScript);
          if (jsonData.offers && jsonData.offers.price) {
            price = parseInt(jsonData.offers.price);
          }
        } catch (e) {
          console.error('[Scraper] 解析 JSON-LD 失敗:', e.message);
        }
      }
    }

    if (!price) {
      throw new Error('無法找到商品價格');
    }

    return {
      productCode,
      productName,
      price,
      url,
      timestamp: new Date().toISOString(),
    };

    } catch (error) {
      lastError = error;
      console.error(`[Scraper] 嘗試 ${attempt}/${maxRetries} 失敗:`, error.message);

      if (attempt < maxRetries) {
        const waitTime = attempt * 5000; // 每次重試等待時間增加
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

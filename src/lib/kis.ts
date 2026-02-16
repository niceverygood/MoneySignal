// ============================================
// 한국투자증권 (KIS) Open API Client
// ============================================

const KIS_BASE_URL =
  process.env.KIS_BASE_URL || "https://openapi.koreainvestment.com:9443";
const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

// Token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

// 국내 주요 종목 (시총 상위 + 관심 종목)
export const KR_STOCK_SYMBOLS = [
  { code: "005930", name: "삼성전자" },
  { code: "000660", name: "SK하이닉스" },
  { code: "373220", name: "LG에너지솔루션" },
  { code: "207940", name: "삼성바이오로직스" },
  { code: "005380", name: "현대차" },
  { code: "000270", name: "기아" },
  { code: "068270", name: "셀트리온" },
  { code: "035420", name: "NAVER" },
  { code: "035720", name: "카카오" },
  { code: "051910", name: "LG화학" },
  { code: "006400", name: "삼성SDI" },
  { code: "028260", name: "삼성물산" },
  { code: "105560", name: "KB금융" },
  { code: "055550", name: "신한지주" },
  { code: "003670", name: "포스코퓨처엠" },
  { code: "066570", name: "LG전자" },
  { code: "012330", name: "현대모비스" },
  { code: "034730", name: "SK" },
  { code: "003550", name: "LG" },
  { code: "032830", name: "삼성생명" },
  { code: "096770", name: "SK이노베이션" },
  { code: "009150", name: "삼성전기" },
  { code: "247540", name: "에코프로비엠" },
  { code: "086520", name: "에코프로" },
  { code: "010130", name: "고려아연" },
  { code: "017670", name: "SK텔레콤" },
  { code: "030200", name: "KT" },
  { code: "000810", name: "삼성화재" },
  { code: "033780", name: "KT&G" },
  { code: "018260", name: "삼성에스디에스" },
  { code: "034020", name: "두산에너빌리티" },
  { code: "011200", name: "HMM" },
  { code: "010950", name: "S-Oil" },
  { code: "316140", name: "우리금융지주" },
  { code: "259960", name: "크래프톤" },
  { code: "003490", name: "대한항공" },
  { code: "352820", name: "하이브" },
  { code: "402340", name: "SK스퀘어" },
  { code: "011170", name: "롯데케미칼" },
  { code: "000100", name: "유한양행" },
];

export interface KisTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface StockPrice {
  code: string;
  name: string;
  currentPrice: number;
  changePrice: number;
  changeRate: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  tradingValue: number;
  per: number;
  pbr: number;
  eps: number;
  marketCap: number;
}

export interface StockDailyPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================
// OAuth Token
// ============================================
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedToken;
  }

  if (!KIS_APP_KEY || !KIS_APP_SECRET) {
    throw new Error("KIS_APP_KEY and KIS_APP_SECRET are required");
  }

  const response = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`KIS Token error: ${response.status} - ${errorText}`);
  }

  const data: KisTokenResponse = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return data.access_token;
}

// ============================================
// Common request headers
// ============================================
function getHeaders(token: string, trId: string) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    authorization: `Bearer ${token}`,
    appkey: KIS_APP_KEY,
    appsecret: KIS_APP_SECRET,
    tr_id: trId,
    custtype: "P",
  };
}

// ============================================
// 주식 현재가 조회
// ============================================
export async function getStockPrice(stockCode: string): Promise<StockPrice | null> {
  try {
    const token = await getAccessToken();
    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}`;

    const response = await fetch(url, {
      headers: getHeaders(token, "FHKST01010100"),
    });

    if (!response.ok) {
      console.error(`KIS price error for ${stockCode}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const output = data.output;

    if (!output) return null;

    const symbolInfo = KR_STOCK_SYMBOLS.find((s) => s.code === stockCode);

    return {
      code: stockCode,
      name: symbolInfo?.name || output.rprs_mrkt_kor_name || stockCode,
      currentPrice: parseInt(output.stck_prpr) || 0,
      changePrice: parseInt(output.prdy_vrss) || 0,
      changeRate: parseFloat(output.prdy_ctrt) || 0,
      openPrice: parseInt(output.stck_oprc) || 0,
      highPrice: parseInt(output.stck_hgpr) || 0,
      lowPrice: parseInt(output.stck_lwpr) || 0,
      volume: parseInt(output.acml_vol) || 0,
      tradingValue: parseInt(output.acml_tr_pbmn) || 0,
      per: parseFloat(output.per) || 0,
      pbr: parseFloat(output.pbr) || 0,
      eps: parseFloat(output.eps) || 0,
      marketCap: parseInt(output.hts_avls) || 0,
    };
  } catch (error) {
    console.error(`Failed to get price for ${stockCode}:`, error);
    return null;
  }
}

// ============================================
// 여러 종목 현재가 일괄 조회
// ============================================
export async function getMultipleStockPrices(
  stockCodes: string[]
): Promise<StockPrice[]> {
  const results: StockPrice[] = [];

  // KIS API는 종목별 개별 호출 필요 (초당 20건 제한)
  for (let i = 0; i < stockCodes.length; i++) {
    const price = await getStockPrice(stockCodes[i]);
    if (price) results.push(price);

    // Rate limit: 20 requests per second
    if (i > 0 && i % 18 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// ============================================
// 일별 시세 조회 (차트 데이터)
// ============================================
export async function getStockDailyChart(
  stockCode: string,
  period: "D" | "W" | "M" = "D",
  count: number = 30
): Promise<StockDailyPrice[]> {
  try {
    const token = await getAccessToken();

    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const startDate = new Date(Date.now() - count * 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: stockCode,
      FID_INPUT_DATE_1: startDate,
      FID_INPUT_DATE_2: endDate,
      FID_PERIOD_DIV_CODE: period,
      FID_ORG_ADJ_PRC: "0",
    });

    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params}`;

    const response = await fetch(url, {
      headers: getHeaders(token, "FHKST03010100"),
    });

    if (!response.ok) {
      console.error(`KIS chart error for ${stockCode}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const output2 = data.output2;

    if (!output2 || !Array.isArray(output2)) return [];

    return output2
      .filter((item: Record<string, string>) => item.stck_bsop_date)
      .map((item: Record<string, string>) => ({
        date: item.stck_bsop_date,
        open: parseInt(item.stck_oprc) || 0,
        high: parseInt(item.stck_hgpr) || 0,
        low: parseInt(item.stck_lwpr) || 0,
        close: parseInt(item.stck_clpr) || 0,
        volume: parseInt(item.acml_vol) || 0,
      }))
      .reverse()
      .slice(-count);
  } catch (error) {
    console.error(`Failed to get chart for ${stockCode}:`, error);
    return [];
  }
}

// ============================================
// AI용 종목 데이터 포맷팅
// ============================================
export function formatStockDataForAI(
  price: StockPrice,
  dailyPrices: StockDailyPrice[]
): string {
  const recent = dailyPrices.slice(-20);
  const highs = recent.map((d) => d.high);
  const lows = recent.map((d) => d.low);
  const high20 = Math.max(...highs);
  const low20 = Math.min(...lows);

  const priceData = recent.map((d) => ({
    date: d.date,
    o: d.open,
    h: d.high,
    l: d.low,
    c: d.close,
    v: d.volume,
  }));

  return `
종목: ${price.code} (${price.name})
현재가: ${price.currentPrice.toLocaleString()}원
전일 대비: ${price.changePrice >= 0 ? "+" : ""}${price.changePrice.toLocaleString()}원 (${price.changeRate >= 0 ? "+" : ""}${price.changeRate}%)
시가: ${price.openPrice.toLocaleString()}원
고가: ${price.highPrice.toLocaleString()}원
저가: ${price.lowPrice.toLocaleString()}원
거래량: ${price.volume.toLocaleString()}주
거래대금: ${Math.round(price.tradingValue / 100000000).toLocaleString()}억원
PER: ${price.per} | PBR: ${price.pbr} | EPS: ${price.eps}
시가총액: ${Math.round(price.marketCap / 10000).toLocaleString()}조원
20일 최고: ${high20.toLocaleString()}원
20일 최저: ${low20.toLocaleString()}원
최근 20일 데이터:
${JSON.stringify(priceData, null, 2)}`;
}

// ============================================
// 전체 종목 스캔 (상위 40개 데이터 수집)
// ============================================
export async function scanTopStocks(): Promise<{
  prices: StockPrice[];
  formatted: string;
}> {
  const codes = KR_STOCK_SYMBOLS.slice(0, 40).map((s) => s.code);
  const prices = await getMultipleStockPrices(codes);

  // Sort by trading value (거래대금) descending - most active stocks
  prices.sort((a, b) => b.tradingValue - a.tradingValue);

  // Get daily chart for top 15 by activity
  const top15 = prices.slice(0, 15);
  const detailedData: string[] = [];

  for (const stock of top15) {
    const daily = await getStockDailyChart(stock.code, "D", 30);
    detailedData.push(formatStockDataForAI(stock, daily));

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    prices,
    formatted: detailedData.join("\n\n---\n\n"),
  };
}

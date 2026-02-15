// ============================================
// Binance API Client
// ============================================

const BINANCE_API_BASE = "https://api.binance.com";
const BINANCE_FUTURES_BASE = "https://fapi.binance.com";

// Top 20 crypto symbols for analysis
export const TOP_CRYPTO_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "ADAUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT", "LINKUSDT",
  "UNIUSDT", "ATOMUSDT", "NEARUSDT", "APTUSDT", "ARBUSDT",
  "OPUSDT", "FETUSDT", "RENDERUSDT", "INJUSDT", "TIAUSDT",
];

export const SYMBOL_NAMES: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
  XRPUSDT: "XRP",
  ADAUSDT: "Cardano",
  AVAXUSDT: "Avalanche",
  DOTUSDT: "Polkadot",
  MATICUSDT: "Polygon",
  LINKUSDT: "Chainlink",
  UNIUSDT: "Uniswap",
  ATOMUSDT: "Cosmos",
  NEARUSDT: "NEAR Protocol",
  APTUSDT: "Aptos",
  ARBUSDT: "Arbitrum",
  OPUSDT: "Optimism",
  FETUSDT: "Fetch.AI",
  RENDERUSDT: "Render",
  INJUSDT: "Injective",
  TIAUSDT: "Celestia",
};

export interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export interface TickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export async function getSpotKlines(
  symbol: string,
  interval: string = "4h",
  limit: number = 50
): Promise<KlineData[]> {
  const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

  const data = await response.json();
  return data.map((k: string[]) => ({
    openTime: Number(k[0]),
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: Number(k[6]),
  }));
}

export async function getFuturesKlines(
  symbol: string,
  interval: string = "4h",
  limit: number = 50
): Promise<KlineData[]> {
  const url = `${BINANCE_FUTURES_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance Futures API error: ${response.status}`);

  const data = await response.json();
  return data.map((k: string[]) => ({
    openTime: Number(k[0]),
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: Number(k[6]),
  }));
}

export async function getSpotTickers(): Promise<TickerData[]> {
  const url = `${BINANCE_API_BASE}/api/v3/ticker/24hr`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

  const data: TickerData[] = await response.json();
  return data.filter((t) => TOP_CRYPTO_SYMBOLS.includes(t.symbol));
}

export async function getSpotPrice(symbol: string): Promise<number> {
  const url = `${BINANCE_API_BASE}/api/v3/ticker/price?symbol=${symbol}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

  const data = await response.json();
  return parseFloat(data.price);
}

export async function getMultipleSpotPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  const url = `${BINANCE_API_BASE}/api/v3/ticker/price`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

  const data: Array<{ symbol: string; price: string }> = await response.json();
  const prices: Record<string, number> = {};

  for (const item of data) {
    if (symbols.includes(item.symbol)) {
      prices[item.symbol] = parseFloat(item.price);
    }
  }

  return prices;
}

export function formatMarketDataForAI(
  klines: KlineData[],
  symbol: string
): string {
  const recent = klines.slice(-20);
  const prices = recent.map((k) => ({
    time: new Date(k.openTime).toISOString(),
    o: parseFloat(k.open).toFixed(2),
    h: parseFloat(k.high).toFixed(2),
    l: parseFloat(k.low).toFixed(2),
    c: parseFloat(k.close).toFixed(2),
    v: parseFloat(k.volume).toFixed(0),
  }));

  const currentPrice = parseFloat(recent[recent.length - 1].close);
  const prevPrice = parseFloat(recent[recent.length - 2].close);
  const change = ((currentPrice - prevPrice) / prevPrice) * 100;

  const highs = recent.map((k) => parseFloat(k.high));
  const lows = recent.map((k) => parseFloat(k.low));
  const high20 = Math.max(...highs);
  const low20 = Math.min(...lows);

  return `
종목: ${symbol} (${SYMBOL_NAMES[symbol] || symbol})
현재가: ${currentPrice}
전봉 대비: ${change > 0 ? "+" : ""}${change.toFixed(2)}%
20봉 최고: ${high20}
20봉 최저: ${low20}
최근 20봉 데이터:
${JSON.stringify(prices, null, 2)}`;
}

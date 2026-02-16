// ============================================
// Symbol Detector - Korean/English keyword → trading symbol mapping
// ============================================

interface SymbolInfo {
  symbol: string;
  type: "crypto" | "kr_stock" | "futures";
  name: string;
}

const SYMBOL_MAP: Record<string, SymbolInfo> = {
  // Crypto
  btc: { symbol: "BTCUSDT", type: "crypto", name: "Bitcoin" },
  비트코인: { symbol: "BTCUSDT", type: "crypto", name: "Bitcoin" },
  eth: { symbol: "ETHUSDT", type: "crypto", name: "Ethereum" },
  이더리움: { symbol: "ETHUSDT", type: "crypto", name: "Ethereum" },
  sol: { symbol: "SOLUSDT", type: "crypto", name: "Solana" },
  솔라나: { symbol: "SOLUSDT", type: "crypto", name: "Solana" },
  xrp: { symbol: "XRPUSDT", type: "crypto", name: "XRP" },
  리플: { symbol: "XRPUSDT", type: "crypto", name: "XRP" },
  ada: { symbol: "ADAUSDT", type: "crypto", name: "Cardano" },
  bnb: { symbol: "BNBUSDT", type: "crypto", name: "BNB" },
  avax: { symbol: "AVAXUSDT", type: "crypto", name: "Avalanche" },
  dot: { symbol: "DOTUSDT", type: "crypto", name: "Polkadot" },
  link: { symbol: "LINKUSDT", type: "crypto", name: "Chainlink" },
  near: { symbol: "NEARUSDT", type: "crypto", name: "NEAR" },

  // Korean stocks
  삼성전자: { symbol: "005930", type: "kr_stock", name: "삼성전자" },
  삼전: { symbol: "005930", type: "kr_stock", name: "삼성전자" },
  "sk하이닉스": { symbol: "000660", type: "kr_stock", name: "SK하이닉스" },
  하이닉스: { symbol: "000660", type: "kr_stock", name: "SK하이닉스" },
  네이버: { symbol: "035420", type: "kr_stock", name: "NAVER" },
  naver: { symbol: "035420", type: "kr_stock", name: "NAVER" },
  카카오: { symbol: "035720", type: "kr_stock", name: "카카오" },
  현대차: { symbol: "005380", type: "kr_stock", name: "현대차" },
  기아: { symbol: "000270", type: "kr_stock", name: "기아" },
  "lg에너지솔루션": { symbol: "373220", type: "kr_stock", name: "LG에너지솔루션" },
  셀트리온: { symbol: "068270", type: "kr_stock", name: "셀트리온" },
  "lg화학": { symbol: "051910", type: "kr_stock", name: "LG화학" },
  "삼성sdi": { symbol: "006400", type: "kr_stock", name: "삼성SDI" },
  포스코퓨처엠: { symbol: "003670", type: "kr_stock", name: "포스코퓨처엠" },
  에코프로: { symbol: "086520", type: "kr_stock", name: "에코프로" },
  크래프톤: { symbol: "259960", type: "kr_stock", name: "크래프톤" },
  하이브: { symbol: "352820", type: "kr_stock", name: "하이브" },

  // Futures
  나스닥: { symbol: "NQ", type: "futures", name: "나스닥100 선물" },
  nasdaq: { symbol: "NQ", type: "futures", name: "나스닥100 선물" },
  "s&p": { symbol: "ES", type: "futures", name: "S&P500 선물" },
  sp500: { symbol: "ES", type: "futures", name: "S&P500 선물" },
  금: { symbol: "GC", type: "futures", name: "금 선물" },
  gold: { symbol: "GC", type: "futures", name: "금 선물" },
  원유: { symbol: "CL", type: "futures", name: "원유 선물" },
  oil: { symbol: "CL", type: "futures", name: "원유 선물" },
  wti: { symbol: "CL", type: "futures", name: "원유 선물" },
};

/**
 * Detect trading symbols mentioned in a question (Korean or English).
 * Returns deduplicated results based on the symbol field.
 */
export function detectSymbols(
  question: string
): Array<{ symbol: string; type: string; name: string }> {
  const lower = question.toLowerCase();
  const seen = new Set<string>();
  const results: Array<{ symbol: string; type: string; name: string }> = [];

  for (const [keyword, info] of Object.entries(SYMBOL_MAP)) {
    if (lower.includes(keyword) && !seen.has(info.symbol)) {
      seen.add(info.symbol);
      results.push({ symbol: info.symbol, type: info.type, name: info.name });
    }
  }

  return results;
}

/**
 * Get a human-readable category label from a symbol type.
 */
export function getSymbolCategory(type: string): string {
  switch (type) {
    case "crypto":
      return "암호화폐";
    case "kr_stock":
      return "국내주식";
    case "futures":
      return "해외선물";
    default:
      return "기타";
  }
}

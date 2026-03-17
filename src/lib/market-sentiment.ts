// ============================================
// 시장 센티먼트 (공포-탐욕 지수) 계산
// ============================================

export interface MarketIndicator {
  name: string;
  value: number;       // 원본 값 (가격, 지수 등)
  change: number;      // 일간 변동률 (%)
  score: number;       // 0~100 정규화 점수
  weight: number;      // 가중치
  source: string;
}

export interface SentimentResult {
  compositeScore: number;      // 0~100 최종 점수
  level: SentimentLevel;
  label: string;
  buyWeight: number;           // AI 점수에 적용할 매수 가중치
  sellWeight: number;
  indicators: MarketIndicator[];
  updatedAt: string;
}

export type SentimentLevel =
  | "extreme_fear"
  | "fear"
  | "caution"
  | "neutral"
  | "optimistic"
  | "greed"
  | "extreme_greed";

// ============================================
// 시장 레벨 판정 (7단계)
// ============================================
export function getMarketLevel(score: number): {
  level: SentimentLevel;
  label: string;
  buyWeight: number;
  sellWeight: number;
  color: string;
  emoji: string;
} {
  if (score <= 15)
    return { level: "extreme_fear", label: "극도의 공포", buyWeight: 1.0, sellWeight: 0.0, color: "#8B0000", emoji: "😱" };
  if (score <= 30)
    return { level: "fear", label: "공포", buyWeight: 0.8, sellWeight: 0.1, color: "#FF5252", emoji: "😨" };
  if (score <= 40)
    return { level: "caution", label: "경계", buyWeight: 0.6, sellWeight: 0.2, color: "#FF9800", emoji: "😟" };
  if (score <= 60)
    return { level: "neutral", label: "중립", buyWeight: 0.5, sellWeight: 0.5, color: "#FFD600", emoji: "😐" };
  if (score <= 70)
    return { level: "optimistic", label: "낙관", buyWeight: 0.4, sellWeight: 0.5, color: "#66BB6A", emoji: "😊" };
  if (score <= 85)
    return { level: "greed", label: "탐욕", buyWeight: 0.2, sellWeight: 0.7, color: "#43A047", emoji: "🤑" };
  return { level: "extreme_greed", label: "극도의 탐욕", buyWeight: 0.0, sellWeight: 1.0, color: "#1B5E20", emoji: "🤯" };
}

// ============================================
// 투자 판정 라벨
// ============================================
export function getInvestmentVerdict(weightedScore: number): {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
} {
  if (weightedScore >= 3.5)
    return { label: "적극 매수", color: "#00E676", bgColor: "rgba(0,230,118,0.1)", emoji: "🟢" };
  if (weightedScore >= 2.5)
    return { label: "분할 매수", color: "#448AFF", bgColor: "rgba(68,138,255,0.1)", emoji: "🔵" };
  if (weightedScore >= 1.5)
    return { label: "관망", color: "#FFD600", bgColor: "rgba(255,214,0,0.1)", emoji: "🟡" };
  return { label: "매수 금지", color: "#FF5252", bgColor: "rgba(255,82,82,0.1)", emoji: "🔴" };
}

// ============================================
// 일간 변동률 → 점수 변환
// ============================================
function calcDailyChangeScore(changePercent: number): number {
  // -3% = 0점, 0% = 50점, +3% = 100점
  const score = ((changePercent + 3) / 6) * 100;
  return Math.max(0, Math.min(100, score));
}

// ============================================
// 52주 위치 → 점수 변환
// ============================================
function calc52WeekPosition(current: number, low52w: number, high52w: number): number {
  if (high52w === low52w) return 50;
  const score = ((current - low52w) / (high52w - low52w)) * 100;
  return Math.max(0, Math.min(100, score));
}

// ============================================
// 네이버 금융 → KOSPI / KOSDAQ / USD-KRW
// ============================================
async function fetchNaverIndex(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  high52w: number;
  low52w: number;
} | null> {
  try {
    const url = `https://m.stock.naver.com/api/index/${symbol}/basic`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();

    return {
      price: parseFloat(data.closePrice?.replace(/,/g, "")) || 0,
      change: parseFloat(data.compareToPreviousClosePrice?.replace(/,/g, "")) || 0,
      changePercent: parseFloat(data.fluctuationsRatio?.replace(/,/g, "")) || 0,
      high52w: parseFloat(data.high52wPrice?.replace(/,/g, "")) || 0,
      low52w: parseFloat(data.low52wPrice?.replace(/,/g, "")) || 0,
    };
  } catch (e) {
    console.error(`Naver fetch error for ${symbol}:`, e);
    return null;
  }
}

async function fetchExchangeRate(): Promise<{
  price: number;
  change: number;
  changePercent: number;
} | null> {
  // Yahoo Finance KRW=X
  try {
    const data = await fetchYahooQuote("KRW=X");
    if (data) {
      return { price: data.price, change: data.change, changePercent: data.changePercent };
    }
  } catch { /* fallthrough */ }
  return null;
}

// ============================================
// Yahoo Finance → S&P 500, NASDAQ, VIX
// ============================================
async function fetchYahooQuote(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  high52w: number;
  low52w: number;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();

    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    return {
      price,
      change,
      changePercent,
      high52w: meta.fiftyTwoWeekHigh || price,
      low52w: meta.fiftyTwoWeekLow || price,
    };
  } catch (e) {
    console.error(`Yahoo fetch error for ${symbol}:`, e);
    return null;
  }
}

// ============================================
// 전체 센티먼트 계산
// ============================================
export async function calculateMarketSentiment(): Promise<SentimentResult> {
  // 6개 지표를 병렬 조회
  const [kospi, kosdaq, sp500, nasdaq, vix, usdkrw] = await Promise.all([
    fetchNaverIndex("KOSPI"),
    fetchNaverIndex("KOSDAQ"),
    fetchYahooQuote("^GSPC"),
    fetchYahooQuote("^IXIC"),
    fetchYahooQuote("^VIX"),
    fetchExchangeRate(),
  ]);

  const indicators: MarketIndicator[] = [];

  // 1. KOSPI (30%)
  if (kospi) {
    const dailyScore = calcDailyChangeScore(kospi.changePercent);
    const positionScore = calc52WeekPosition(kospi.price, kospi.low52w, kospi.high52w);
    const combined = dailyScore * 0.6 + positionScore * 0.4;
    indicators.push({
      name: "KOSPI",
      value: kospi.price,
      change: kospi.changePercent,
      score: combined,
      weight: 0.3,
      source: "naver",
    });
  }

  // 2. KOSDAQ (15%)
  if (kosdaq) {
    const dailyScore = calcDailyChangeScore(kosdaq.changePercent);
    const positionScore = calc52WeekPosition(kosdaq.price, kosdaq.low52w, kosdaq.high52w);
    const combined = dailyScore * 0.6 + positionScore * 0.4;
    indicators.push({
      name: "KOSDAQ",
      value: kosdaq.price,
      change: kosdaq.changePercent,
      score: combined,
      weight: 0.15,
      source: "naver",
    });
  }

  // 3. S&P 500 (20%)
  if (sp500) {
    const dailyScore = calcDailyChangeScore(sp500.changePercent);
    const positionScore = calc52WeekPosition(sp500.price, sp500.low52w, sp500.high52w);
    const combined = dailyScore * 0.6 + positionScore * 0.4;
    indicators.push({
      name: "S&P 500",
      value: sp500.price,
      change: sp500.changePercent,
      score: combined,
      weight: 0.2,
      source: "yahoo",
    });
  }

  // 4. NASDAQ (15%)
  if (nasdaq) {
    const dailyScore = calcDailyChangeScore(nasdaq.changePercent);
    const positionScore = calc52WeekPosition(nasdaq.price, nasdaq.low52w, nasdaq.high52w);
    const combined = dailyScore * 0.6 + positionScore * 0.4;
    indicators.push({
      name: "NASDAQ",
      value: nasdaq.price,
      change: nasdaq.changePercent,
      score: combined,
      weight: 0.15,
      source: "yahoo",
    });
  }

  // 5. VIX (10%) — VIX는 역방향: VIX 높으면 공포
  if (vix) {
    // VIX 10=100점(탐욕), VIX 30+=0점(공포)
    const vixScore = Math.max(0, Math.min(100, ((30 - vix.price) / 20) * 100));
    indicators.push({
      name: "VIX",
      value: vix.price,
      change: vix.changePercent,
      score: vixScore,
      weight: 0.1,
      source: "yahoo",
    });
  }

  // 6. USD/KRW (10%) — 환율 상승 = 외자 유출 = 매도 우위
  if (usdkrw) {
    const fxScore = Math.max(0, Math.min(100, 50 - usdkrw.changePercent * 40));
    indicators.push({
      name: "USD/KRW",
      value: usdkrw.price,
      change: usdkrw.changePercent,
      score: fxScore,
      weight: 0.1,
      source: "yahoo",
    });
  }

  // 가중 합산
  let totalWeight = 0;
  let weightedSum = 0;
  for (const ind of indicators) {
    weightedSum += ind.score * ind.weight;
    totalWeight += ind.weight;
  }

  // 데이터 없는 경우 중립(50) 반환
  const compositeScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  const marketLevel = getMarketLevel(compositeScore);

  return {
    compositeScore,
    level: marketLevel.level,
    label: marketLevel.label,
    buyWeight: marketLevel.buyWeight,
    sellWeight: marketLevel.sellWeight,
    indicators,
    updatedAt: new Date().toISOString(),
  };
}

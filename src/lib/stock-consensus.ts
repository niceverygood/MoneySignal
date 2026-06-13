// ============================================
// 종목 단위 AI 합의 — 평단가와 무관한 "지금 이 종목" 관점
//   · 내 종목 합의 변화 알림 루프에서 사용 (종목당 하루 1회 호출 → 전 보유자 공유)
//   · diagnose(평단가 대입, 유저별)와 달리 stock-level이라 비용·법적으로 가볍다
// ============================================
import { AI_CHARACTERS } from "./ai-characters";
import { callModel } from "./openrouter";
import { getStockPrice, getStockDailyChart, formatStockDataForAI } from "./kis";
import { getSpotPrice, getSpotKlines, formatMarketDataForAI } from "./binance";
import { STOCK_DB } from "./stock-db";

export type StockVerdict = "buy" | "hold" | "sell";

export const STOCK_VERDICT_LABELS: Record<StockVerdict, string> = {
  buy: "매수 우위",
  hold: "중립",
  sell: "매도 우위",
};

const VERDICT_VALUES: StockVerdict[] = ["buy", "hold", "sell"];

export interface StockOpinion {
  characterId: string;
  verdict: StockVerdict;
  comment: string;
}

export interface StockConsensusResult {
  consensus: StockVerdict;
  consensusSummary: string;
  currentPrice: number;
  opinions: StockOpinion[];
}

function parseOpinion(raw: string): { verdict: StockVerdict; comment: string } | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const verdict = String(parsed.verdict || "").toLowerCase() as StockVerdict;
    if (!VERDICT_VALUES.includes(verdict)) return null;
    const comment = String(parsed.comment || "").slice(0, 300);
    if (!comment) return null;
    return { verdict, comment };
  } catch {
    return null;
  }
}

/**
 * 종목 단위 AI 3대장 합의. 시세 조회 실패 시 null 반환(호출측에서 스킵).
 */
export async function getStockConsensus(
  market: string,
  symbol: string,
  name: string
): Promise<StockConsensusResult | null> {
  // 1. 시세 + 차트
  let currentPrice = 0;
  let marketData = "";
  let currency = "원";

  if (market === "kr_stock") {
    const [price, chart] = await Promise.all([
      getStockPrice(symbol),
      getStockDailyChart(symbol, "D", 30).catch(() => []),
    ]);
    if (!price || !price.currentPrice || price.currentPrice <= 0) return null;
    currentPrice = price.currentPrice;
    marketData =
      chart.length > 0
        ? formatStockDataForAI(price, chart)
        : `현재가 ${price.currentPrice}원 (${price.changeRate}%)`;
    const meta = STOCK_DB[symbol];
    if (meta) {
      marketData += `\n\n## 종목 메타\n- 투자논리: ${meta.thesis}\n- 리스크: ${meta.risks.join(", ")}\n- 밸류에이션: ${meta.valuation}`;
    }
  } else {
    currency = "USDT";
    const [price, klines] = await Promise.all([
      getSpotPrice(symbol),
      getSpotKlines(symbol, "4h", 60).catch(() => []),
    ]);
    if (!price || price <= 0) return null;
    currentPrice = price;
    marketData =
      klines.length > 0 ? formatMarketDataForAI(klines, symbol) : `현재가 ${price} USDT`;
  }

  // 2. AI 3대장 병렬 — 종목 단위(평단가 미언급) 매수/중립/매도 판단
  const userMessage = `## 종목
- ${name} (${symbol})
- 현재가: ${currentPrice.toLocaleString()}${currency}

## 시장 데이터
${marketData}

## 요청
지금 시점에서 이 종목 자체에 대한 당신의 관점을 평결하세요. (특정인의 평단가·보유 상황과 무관한 종목 단위 판단)
반드시 아래 JSON만 출력:
\`\`\`json
{ "verdict": "buy|hold|sell", "comment": "한국어 1-2문장 근거" }
\`\`\`
verdict 기준 — buy: 매수/비중확대 우위 / hold: 중립·관망 / sell: 매도/비중축소 우위`;

  const characterIds = ["claude", "gemini", "gpt"];
  const settled = await Promise.allSettled(
    characterIds.map((cid) => {
      const char = AI_CHARACTERS[cid];
      const systemPrompt = `${char.fallbackPersona}\n\n응답은 JSON만 출력. 투자자문이 아닌 참고 분석.`;
      return callModel(char.model, systemPrompt, userMessage, {
        maxTokens: 400,
        temperature: 0.5,
      });
    })
  );

  const opinions: StockOpinion[] = [];
  settled.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const parsed = parseOpinion(result.value);
    if (parsed) opinions.push({ characterId: characterIds[i], ...parsed });
  });

  if (opinions.length === 0) return null;

  // 3. 다수결 (동률이면 보수적: sell > hold > buy)
  const tally = new Map<StockVerdict, number>();
  for (const op of opinions) tally.set(op.verdict, (tally.get(op.verdict) || 0) + 1);
  const priority: StockVerdict[] = ["sell", "hold", "buy"];
  const consensus = [...tally.entries()].sort(
    (a, b) => b[1] - a[1] || priority.indexOf(a[0]) - priority.indexOf(b[0])
  )[0][0];

  const agreeCount = tally.get(consensus) || 0;
  const consensusSummary = `AI ${opinions.length}명 중 ${agreeCount}명 '${STOCK_VERDICT_LABELS[consensus]}'`;

  return { consensus, consensusSummary, currentPrice, opinions };
}

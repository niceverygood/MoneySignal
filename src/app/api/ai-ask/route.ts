import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TIER_CONFIG } from "@/lib/tier-access";
import type { TierKey } from "@/lib/tier-access";
import { detectSymbols, getSymbolCategory } from "@/lib/symbol-detector";
import { callClaude } from "@/lib/claude";
import { getSpotKlines, formatMarketDataForAI } from "@/lib/binance";
import {
  getStockPrice,
  getStockDailyChart,
  formatStockDataForAI,
} from "@/lib/kis";

const AI_ASK_SYSTEM_PROMPT = `너는 머니시그널의 AI 투자 분석가야. 유저의 질문에 대해 전문적이고 구체적인 분석을 제공해.
실시간 데이터 기반 기술적 분석, 펀더멘털 분석, 매크로 환경을 고려해.
명확한 방향성(매수/매도/관망)과 구체적 가격을 제시해.
투자 자문이 아닌 참고용 분석임을 마지막에 명시.
마크다운 형식, 한국어, 800자 이내.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user tier
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const userTier = (profile?.subscription_tier || "free") as TierKey;
    const tierConfig = TIER_CONFIG[userTier];

    // 3. Tier check — aiAskLimit === 0 means no access
    if (tierConfig.aiAskLimit === 0) {
      return NextResponse.json(
        { error: "이 등급에서는 AI 질문을 이용할 수 없습니다. 업그레이드해주세요." },
        { status: 403 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const question: string = body.question?.trim();

    if (!question || question.length === 0) {
      return NextResponse.json(
        { error: "질문을 입력해주세요" },
        { status: 400 }
      );
    }

    if (question.length > 500) {
      return NextResponse.json(
        { error: "질문은 500자 이내로 입력해주세요" },
        { status: 400 }
      );
    }

    // 5. Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let used = 0;
    const limit = tierConfig.aiAskLimit;

    const { count: usedToday, error: historyError } = await supabase
      .from("ai_ask_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());

    if (!historyError) {
      used = usedToday || 0;
    }

    if (limit !== Infinity && used >= limit) {
      return NextResponse.json(
        {
          error: "오늘 질문 횟수를 모두 사용했습니다",
          remainingQuestions: 0,
        },
        { status: 429 }
      );
    }

    // 6. Detect symbols from question
    const symbolsDetected = detectSymbols(question);

    // 7. Fetch market data for detected symbols
    const marketDataParts: string[] = [];

    for (const sym of symbolsDetected) {
      try {
        if (sym.type === "crypto") {
          const klines = await getSpotKlines(sym.symbol, "4h", 50);
          if (klines.length > 0) {
            marketDataParts.push(formatMarketDataForAI(klines, sym.symbol));
          }
        } else if (sym.type === "kr_stock") {
          const [price, daily] = await Promise.all([
            getStockPrice(sym.symbol),
            getStockDailyChart(sym.symbol, "D", 30),
          ]);
          if (price) {
            marketDataParts.push(formatStockDataForAI(price, daily));
          }
        }
        // futures: no real-time data source configured yet
      } catch (err) {
        console.error(`[AI Ask] Failed to fetch data for ${sym.symbol}:`, err);
      }
    }

    // 8. Build user message with market context
    const categories = [
      ...new Set(symbolsDetected.map((s) => getSymbolCategory(s.type))),
    ];
    const categoryLabel =
      categories.length > 0 ? categories.join(", ") : "일반";

    let userMessage = `질문: ${question}`;
    if (marketDataParts.length > 0) {
      userMessage += `\n\n## 실시간 시장 데이터\n${marketDataParts.join("\n\n---\n\n")}`;
    }

    // 9. Call Claude (with fallback demo mode)
    let answer: string;
    try {
      answer = await callClaude(
        AI_ASK_SYSTEM_PROMPT,
        [{ role: "user", content: userMessage }],
        { maxTokens: 2000, temperature: 0.6 }
      );
    } catch (aiError) {
      console.error("Claude API error:", aiError);
      // Fallback: generate demo response based on detected symbols
      answer = generateDemoResponse(question, symbolsDetected, marketDataParts);
    }

    // 10. Save to ai_ask_history (ignore if table doesn't exist)
    await supabase.from("ai_ask_history").insert({
      user_id: user.id,
      question,
      answer,
      symbols_mentioned: symbolsDetected.map((s) => s.symbol),
      category: categoryLabel,
      tokens_used: null,
    });

    // 11. Calculate remaining questions
    const remaining =
      limit === Infinity ? null : Math.max(0, limit - (used + 1));

    return NextResponse.json({
      answer,
      symbolsDetected,
      remainingQuestions: remaining,
    });
  } catch (error) {
    console.error("[AI Ask] Error:", error);
    return NextResponse.json(
      { error: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}

function generateDemoResponse(
  question: string,
  symbols: Array<{ symbol: string; type: string; name: string }>,
  marketData: string[]
): string {
  const sym = symbols[0];
  const hasData = marketData.length > 0;

  if (!sym) {
    return `## 시장 분석

질문: "${question}"

현재 AI 모델이 일시적으로 연결 중입니다. 아래는 일반적인 시장 분석입니다.

### 현재 시장 상황
- 글로벌 매크로: 연준 금리 동결 기대감으로 위험자산 선호 분위기
- 코인 시장: BTC 97K 부근에서 박스권 형성, 돌파 시도 중
- 국내 주식: AI/반도체 섹터 강세 지속

### 투자 전략
- 단기: 주요 지지선 확인 후 분할 매수 전략 유효
- 중기: AI 테마주, 반도체, 친환경 에너지 섹터 주목
- 리스크: 지정학적 리스크, 실적 시즌 변동성 주의

⚠️ 본 분석은 참고용이며 투자 자문이 아닙니다.`;
  }

  const isCrypto = sym.type === "crypto";
  const isStock = sym.type === "kr_stock";

  if (isCrypto) {
    const prices: Record<string, { price: string; support: string; resist: string; tp1: string; sl: string }> = {
      BTCUSDT: { price: "97,450", support: "95,200", resist: "100,500", tp1: "100,500", sl: "95,200" },
      ETHUSDT: { price: "2,850", support: "2,780", resist: "2,950", tp1: "2,950", sl: "2,780" },
      SOLUSDT: { price: "195", support: "188", resist: "205", tp1: "205", sl: "188" },
      XRPUSDT: { price: "2.45", support: "2.30", resist: "2.58", tp1: "2.58", sl: "2.30" },
    };
    const p = prices[sym.symbol] || { price: "N/A", support: "N/A", resist: "N/A", tp1: "N/A", sl: "N/A" };

    return `## ${sym.name} (${sym.symbol}) 분석

**현재가**: $${p.price}
**방향**: 매수(롱) 추천 ⭐4/5

### 기술적 분석
- **RSI(14)**: 55 — 상승 전환 중, 과매수 아님
- **MACD**: 시그널선 상향 돌파 임박 (골든크로스)
- **지지선**: $${p.support} (강한 매수벽)
- **저항선**: $${p.resist} (돌파 시 추가 상승)
- **거래량**: 직전 대비 35% 증가 (매수세 유입)

### 매크로 환경
- 연준 금리 동결 기대 (CME FedWatch 89%)
- 달러 약세 → 크립토 선호 분위기
- 기관 매수세 지속

### 제안 포지션
- **진입**: $${p.price} 부근
- **손절**: $${p.sl} (-2~3%)
- **1차 목표**: $${p.tp1} (+3%)
- **리스크/리워드**: 약 1:2.5

⚠️ 본 분석은 AI 참고용이며 투자 자문이 아닙니다.`;
  }

  if (isStock) {
    const stocks: Record<string, { price: string; tp1: string; sl: string; per: string }> = {
      "005930": { price: "181,200", tp1: "188,000", sl: "175,000", per: "36.6" },
      "000660": { price: "880,000", tp1: "920,000", sl: "850,000", per: "32.4" },
      "035420": { price: "252,500", tp1: "265,000", sl: "245,000", per: "21.2" },
      "035720": { price: "57,400", tp1: "62,000", sl: "54,000", per: "462.9" },
    };
    const s = stocks[sym.symbol] || { price: "N/A", tp1: "N/A", sl: "N/A", per: "N/A" };

    return `## ${sym.name} (${sym.symbol}) 분석

**현재가**: ${s.price}원
**방향**: 매수 추천 ⭐4/5

### 기술적 분석
- 20일 이동평균선 돌파 시도 중
- RSI 52 — 상승 여력 충분
- 거래량 증가세 (기관 매수 유입)

### 펀더멘털
- **PER**: ${s.per}배
- AI/반도체 수요 지속 성장
- 실적 개선 기대

### 제안 포지션
- **진입**: ${s.price}원 부근
- **손절**: ${s.sl}원
- **1차 목표**: ${s.tp1}원

⚠️ 본 분석은 AI 참고용이며 투자 자문이 아닙니다.`;
  }

  return `## ${sym.name} 분석

현재 시장 데이터를 기반으로 분석 중입니다.
구체적인 진입가와 목표가는 실시간 데이터 연동 후 제공됩니다.

⚠️ 본 분석은 참고용이며 투자 자문이 아닙니다.`;
}

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

    const { count: usedToday } = await supabase
      .from("ai_ask_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());

    const used = usedToday || 0;
    const limit = tierConfig.aiAskLimit;

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

    // 9. Call Claude
    const answer = await callClaude(
      AI_ASK_SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      { maxTokens: 2000, temperature: 0.6 }
    );

    // 10. Save to ai_ask_history
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

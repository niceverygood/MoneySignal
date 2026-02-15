import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getSpotKlines,
  getFuturesKlines,
  getSpotTickers,
  TOP_CRYPTO_SYMBOLS,
  SYMBOL_NAMES,
  formatMarketDataForAI,
} from "@/lib/binance";
import {
  conductAIDebate,
  parseSignalsFromAI,
  callOpenRouter,
} from "@/lib/openrouter";
import type { SignalCategory } from "@/types";

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === process.env.CRON_SECRET;
}

// ============================================
// COIN SPOT Signal Generation
// ============================================
async function generateCoinSpotSignals(): Promise<Record<string, unknown>[]> {
  console.log("[Signal Engine] Generating coin spot signals...");

  // Fetch market data for top symbols
  const marketDataPromises = TOP_CRYPTO_SYMBOLS.slice(0, 10).map(
    async (symbol) => {
      try {
        const klines = await getSpotKlines(symbol, "4h", 50);
        return { symbol, data: formatMarketDataForAI(klines, symbol) };
      } catch (error) {
        console.error(`Failed to fetch ${symbol}:`, error);
        return null;
      }
    }
  );

  const marketDataResults = (await Promise.all(marketDataPromises)).filter(
    Boolean
  ) as { symbol: string; data: string }[];

  const combinedMarketData = marketDataResults
    .map((r) => r.data)
    .join("\n\n---\n\n");

  const { consensus } = await conductAIDebate(
    "코인 현물 매매 시그널 분석 (상위 10개 코인)",
    combinedMarketData,
    3
  );

  const parsedSignals = parseSignalsFromAI(consensus);

  return parsedSignals.map((s) => ({
    ...s,
    category: "coin_spot" as SignalCategory,
    direction: s.direction === "long" ? "buy" : "sell",
    leverage_conservative: null,
    leverage_aggressive: null,
    min_tier_required: "basic",
  }));
}

// ============================================
// COIN FUTURES Signal Generation
// ============================================
async function generateCoinFuturesSignals(): Promise<
  Record<string, unknown>[]
> {
  console.log("[Signal Engine] Generating coin futures signals...");

  // Fetch futures data + get high volatility ones
  const tickers = await getSpotTickers();
  const sortedByVolatility = tickers
    .sort(
      (a, b) =>
        Math.abs(parseFloat(b.priceChangePercent)) -
        Math.abs(parseFloat(a.priceChangePercent))
    )
    .slice(0, 10);

  const futuresSymbols = [
    ...TOP_CRYPTO_SYMBOLS.slice(0, 10),
    ...sortedByVolatility
      .map((t) => t.symbol)
      .filter((s) => !TOP_CRYPTO_SYMBOLS.slice(0, 10).includes(s)),
  ].slice(0, 15);

  const marketDataPromises = futuresSymbols.map(async (symbol) => {
    try {
      const klines = await getFuturesKlines(symbol, "4h", 50);
      return { symbol, data: formatMarketDataForAI(klines, symbol) };
    } catch (error) {
      console.error(`Failed to fetch futures ${symbol}:`, error);
      return null;
    }
  });

  const marketDataResults = (await Promise.all(marketDataPromises)).filter(
    Boolean
  ) as { symbol: string; data: string }[];

  const combinedMarketData = marketDataResults
    .map((r) => r.data)
    .join("\n\n---\n\n");

  const { consensus } = await conductAIDebate(
    "코인 선물 매매 시그널 분석 (레버리지 포함, Long/Short 양방향)",
    combinedMarketData,
    3
  );

  const parsedSignals = parseSignalsFromAI(consensus);

  return parsedSignals.map((s) => ({
    ...s,
    category: "coin_futures" as SignalCategory,
    min_tier_required: "pro",
  }));
}

// ============================================
// OVERSEAS FUTURES Signal Generation
// ============================================
async function generateOverseasFuturesSignals(): Promise<
  Record<string, unknown>[]
> {
  console.log("[Signal Engine] Generating overseas futures signals...");

  const instruments = [
    {
      symbol: "NQ",
      name: "나스닥100 선물",
      description: "NASDAQ 100 E-mini Futures",
    },
    {
      symbol: "ES",
      name: "S&P500 선물",
      description: "S&P 500 E-mini Futures",
    },
    { symbol: "GC", name: "금 선물", description: "Gold Futures (COMEX)" },
    {
      symbol: "CL",
      name: "원유 선물",
      description: "Crude Oil Futures (WTI)",
    },
    {
      symbol: "6E",
      name: "유로/달러 선물",
      description: "Euro FX Futures (CME)",
    },
  ];

  const instrumentInfo = instruments
    .map(
      (i) =>
        `- ${i.symbol} (${i.name}): ${i.description}`
    )
    .join("\n");

  const { consensus } = await conductAIDebate(
    "해외선물 매매 시그널 분석",
    `분석 대상 해외선물:
${instrumentInfo}

최근 글로벌 거시경제 상황과 기술적 분석을 기반으로 각 선물에 대한 매매 시그널을 생성해주세요.
실시간 가격 데이터는 없지만, 당신의 최신 학습 데이터를 기반으로 합리적인 분석과 가격 수준을 제시해주세요.
각 선물의 진입가, 손절가, 익절가를 구체적 수치로 제시하세요.`,
    3
  );

  const parsedSignals = parseSignalsFromAI(consensus);

  return parsedSignals.map((s) => ({
    ...s,
    category: "overseas_futures" as SignalCategory,
    min_tier_required: "premium",
  }));
}

// ============================================
// KR STOCK Signal Generation (AI 3대장 토론)
// ============================================
async function generateKrStockSignals(): Promise<Record<string, unknown>[]> {
  console.log("[Signal Engine] Generating Korean stock signals...");

  // Step 1: Ask GPT to suggest 40 candidate stocks
  const candidateResponse = await callOpenRouter("gpt", [
    {
      role: "user",
      content: `한국 주식 시장에서 현재 매수 관심 종목 40개를 추천해주세요.
대형주, 중형주, 성장주, 가치주를 고루 포함해주세요.
각 종목의 종목코드, 종목명, 현재 관심 포인트를 간단히 설명해주세요.

JSON 형식으로 응답:
{
  "candidates": [
    { "symbol": "005930", "name": "삼성전자", "reason": "AI 반도체 수요 증가" },
    ...
  ]
}`,
    },
  ]);

  // Step 2: Conduct 3-round debate on candidates
  const { consensus } = await conductAIDebate(
    "국내주식 Top 5 매수 추천 - AI 3대장 토론",
    `후보 종목 목록:
${candidateResponse}

위 40개 후보 중에서 3라운드 토론을 통해 Top 5 매수 추천을 도출해주세요.
3명 중 2명 이상이 동의한 종목만 최종 추천에 포함하세요.
각 종목의 진입가, 손절가(-3~5%), 목표가를 구체적으로 제시하세요.`,
    3
  );

  const parsedSignals = parseSignalsFromAI(consensus);

  return parsedSignals.map((s) => ({
    ...s,
    category: "kr_stock" as SignalCategory,
    direction: "buy",
    leverage_conservative: null,
    leverage_aggressive: null,
    min_tier_required: "basic",
  }));
}

// ============================================
// MAIN HANDLER
// ============================================
export async function GET(request: Request) {
  // Verify cron secret in production
  if (
    process.env.NODE_ENV === "production" &&
    !verifyCronSecret(request)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Generate signals for each category
  const categories: {
    key: string;
    fn: () => Promise<Record<string, unknown>[]>;
  }[] = [
    { key: "coin_spot", fn: generateCoinSpotSignals },
    { key: "coin_futures", fn: generateCoinFuturesSignals },
    { key: "overseas_futures", fn: generateOverseasFuturesSignals },
    { key: "kr_stock", fn: generateKrStockSignals },
  ];

  for (const { key, fn } of categories) {
    try {
      const signals = await fn();

      // Save signals to DB
      const signalsToInsert = signals.map((s) => ({
        category: s.category as string,
        symbol: s.symbol as string,
        symbol_name:
          (s.symbol_name as string) ||
          SYMBOL_NAMES[s.symbol as string] ||
          (s.symbol as string),
        direction: s.direction as string,
        entry_price: Number(s.entry_price) || 0,
        stop_loss: s.stop_loss ? Number(s.stop_loss) : null,
        take_profit_1: s.take_profit_1 ? Number(s.take_profit_1) : null,
        take_profit_2: s.take_profit_2 ? Number(s.take_profit_2) : null,
        take_profit_3: s.take_profit_3 ? Number(s.take_profit_3) : null,
        leverage_conservative: s.leverage_conservative
          ? Number(s.leverage_conservative)
          : null,
        leverage_aggressive: s.leverage_aggressive
          ? Number(s.leverage_aggressive)
          : null,
        confidence: Math.min(5, Math.max(1, Number(s.confidence) || 3)),
        timeframe: (s.timeframe as string) || "4h",
        valid_until: new Date(
          Date.now() + 4 * 60 * 60 * 1000
        ).toISOString(),
        ai_reasoning: (s.reasoning as string) || (s.ai_reasoning as string) || "",
        ai_models_used: ["claude", "gemini", "gpt"],
        status: "active",
        min_tier_required: (s.min_tier_required as string) || "basic",
      }));

      if (signalsToInsert.length > 0) {
        const { data, error } = await supabase
          .from("signals")
          .insert(signalsToInsert)
          .select();

        if (error) {
          console.error(`Error inserting ${key} signals:`, error);
          errors.push(`${key}: ${error.message}`);
        } else {
          results[key] = { count: data?.length || 0, signals: data };
          console.log(`[Signal Engine] Saved ${data?.length} ${key} signals`);
        }
      } else {
        results[key] = { count: 0, message: "No signals generated" };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Signal Engine] Error generating ${key}:`, msg);
      errors.push(`${key}: ${msg}`);
      results[key] = { error: msg };
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

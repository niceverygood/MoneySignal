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
  analyzeWithThreePerspectives,
  parseSignalsFromClaude,
} from "@/lib/claude";
import { scanTopStocks } from "@/lib/kis";
import { sendTelegramMessage, formatSignalMessage } from "@/lib/telegram";
import { sendKakaoSignalAlert } from "@/lib/kakao";
import type { SignalCategory, Signal } from "@/types";

// ============================================
// 알림 발송 (텔레그램 + 카카오)
// ============================================
const TIER_ORDER: Record<string, number> = { free: 0, basic: 1, pro: 2, premium: 3, bundle: 4 };

async function sendSignalAlerts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  signals: Signal[]
): Promise<void> {
  try {
    // 텔레그램 연결된 pro+ 유저 조회 (new_signal 알림 ON)
    const { data: telegramUsers } = await supabase
      .from("telegram_connections")
      .select("telegram_chat_id, user_id, notification_settings, profiles!inner(subscription_tier, subscription_expires_at)")
      .eq("is_active", true);

    // 카카오 연결된 유저 조회
    const { data: kakaoUsers } = await supabase
      .from("kakao_connections")
      .select("kakao_user_id, user_id, profiles!inner(subscription_tier, subscription_expires_at)")
      .eq("is_active", true);

    for (const signal of signals) {
      const minTier = signal.min_tier_required || "basic";
      const minTierOrder = TIER_ORDER[minTier] || 1;
      const message = formatSignalMessage(signal);

      // 텔레그램 발송
      if (telegramUsers && process.env.TELEGRAM_BOT_TOKEN) {
        for (const u of telegramUsers) {
          const tier = u.profiles?.subscription_tier || "free";
          const expires = u.profiles?.subscription_expires_at;
          const isExpired = expires && new Date(expires) < new Date();
          const settings = u.notification_settings || {};

          // pro 이상 + new_signal ON + 구독 유효 + 티어 충족
          if (
            TIER_ORDER[tier] >= 2 &&
            !isExpired &&
            settings.new_signal !== false &&
            TIER_ORDER[tier] >= minTierOrder
          ) {
            await sendTelegramMessage(u.telegram_chat_id, message).catch(() => null);
          }
        }
      }

      // 카카오 발송
      if (kakaoUsers && process.env.KAKAO_ACCESS_TOKEN) {
        for (const u of kakaoUsers) {
          const tier = u.profiles?.subscription_tier || "free";
          const expires = u.profiles?.subscription_expires_at;
          const isExpired = expires && new Date(expires) < new Date();

          if (TIER_ORDER[tier] >= 1 && !isExpired && TIER_ORDER[tier] >= minTierOrder) {
            await sendKakaoSignalAlert(u.kakao_user_id, signal).catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.error("[Signal Engine] Alert sending error:", err);
  }
}

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === process.env.CRON_SECRET;
}

// ============================================
// COIN SPOT Signal Generation (Claude Opus 4.6)
// ============================================
async function generateCoinSpotSignals(): Promise<Record<string, unknown>[]> {
  console.log("[Signal Engine] Generating coin spot signals with Claude Opus 4.6...");

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

  const { analysis } = await analyzeWithThreePerspectives(
    "코인 현물 매매 시그널 분석 (Binance 상위 10개 코인, 실시간 데이터)",
    combinedMarketData
  );

  const parsedSignals = parseSignalsFromClaude(analysis);

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
// COIN FUTURES Signal Generation (Claude Opus 4.6)
// ============================================
async function generateCoinFuturesSignals(): Promise<
  Record<string, unknown>[]
> {
  console.log("[Signal Engine] Generating coin futures signals with Claude Opus 4.6...");

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

  const { analysis } = await analyzeWithThreePerspectives(
    "코인 선물 매매 시그널 분석 (Long/Short 양방향, 레버리지 포함)",
    combinedMarketData
  );

  const parsedSignals = parseSignalsFromClaude(analysis);

  return parsedSignals.map((s) => ({
    ...s,
    category: "coin_futures" as SignalCategory,
    min_tier_required: "pro",
  }));
}

// ============================================
// OVERSEAS FUTURES Signal Generation (Claude Opus 4.6)
// ============================================
async function generateOverseasFuturesSignals(): Promise<
  Record<string, unknown>[]
> {
  console.log("[Signal Engine] Generating overseas futures signals with Claude Opus 4.6...");

  const instruments = [
    { symbol: "NQ", name: "나스닥100 선물", description: "NASDAQ 100 E-mini Futures" },
    { symbol: "ES", name: "S&P500 선물", description: "S&P 500 E-mini Futures" },
    { symbol: "GC", name: "금 선물", description: "Gold Futures (COMEX)" },
    { symbol: "CL", name: "원유 선물", description: "Crude Oil Futures (WTI)" },
    { symbol: "6E", name: "유로/달러 선물", description: "Euro FX Futures (CME)" },
  ];

  const instrumentInfo = instruments
    .map((i) => `- ${i.symbol} (${i.name}): ${i.description}`)
    .join("\n");

  const { analysis } = await analyzeWithThreePerspectives(
    "해외선물 매매 시그널 분석",
    `분석 대상 해외선물:
${instrumentInfo}

최근 글로벌 거시경제 상황과 기술적 분석을 기반으로 각 선물에 대한 매매 시그널을 생성해주세요.
각 선물의 진입가, 손절가, 익절가를 구체적 수치로 제시하세요.`
  );

  const parsedSignals = parseSignalsFromClaude(analysis);

  return parsedSignals.map((s) => ({
    ...s,
    category: "overseas_futures" as SignalCategory,
    min_tier_required: "premium",
  }));
}

// ============================================
// KR STOCK Signal Generation (KIS 실제 데이터 + AI 3대장 토론)
// ============================================
async function generateKrStockSignals(): Promise<Record<string, unknown>[]> {
  console.log("[Signal Engine] Generating Korean stock signals with KIS data...");

  // Step 1: KIS API로 실제 주가 데이터 수집 (상위 40종목)
  let marketData: string;
  try {
    const { formatted } = await scanTopStocks();
    marketData = formatted;
    console.log("[Signal Engine] KIS data fetched successfully");
  } catch (error) {
    console.error("[Signal Engine] KIS API failed, falling back to AI-only:", error);
    // Fallback: Claude에게 직접 추천 요청
    const { callClaude } = await import("@/lib/claude");
    const candidateResponse = await callClaude(
      "당신은 한국 주식 시장 전문가입니다.",
      [{
        role: "user",
        content: `한국 주식 시장에서 현재 매수 관심 종목 40개를 추천해주세요.
대형주, 중형주, 성장주, 가치주를 고루 포함해주세요.
각 종목의 종목코드, 종목명, 현재 관심 포인트를 간단히 설명해주세요.
JSON 형식으로 응답해주세요.`,
      }]
    );
    marketData = candidateResponse;
  }

  // Step 2: Claude Opus 4.6 3관점 종합 분석 (펀더멘털 + 기술적 + 매크로)
  const { analysis } = await analyzeWithThreePerspectives(
    "국내주식 Top 5 매수 추천 (한국투자증권 실시간 데이터 기반)",
    `## 한국투자증권 API에서 가져온 실시간 주가 데이터입니다.

${marketData}

## 요청사항
위 실제 시장 데이터를 분석하여 Top 5 매수 추천을 도출해주세요.
- 기술적 분석: 이동평균선, RSI, MACD, 볼린저밴드 관점
- 펀더멘털: PER, PBR, EPS 기반 가치 평가
- 거래량/거래대금 분석: 수급 동향
- 진입가는 현재가 기준, 손절가(-3~5%), 1차/2차/3차 목표가를 구체적으로 제시`
  );

  const parsedSignals = parseSignalsFromClaude(analysis);

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
        ai_models_used: ["claude-opus-4.6"],
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

          // 텔레그램 & 카카오 알림 발송
          if (data && data.length > 0) {
            await sendSignalAlerts(supabase, data as Signal[]);
          }
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

export const maxDuration = 120;

// ============================================
// 내 종목 AI 진단 — AI 3대장이 보유종목을 평결
// POST { holdingId }
// → 실시간 시세 + 차트 + 종목 메타를 3개 AI 페르소나에 병렬 질의
// → verdict(hold|buy_more|reduce|cut) 다수결 합의
// 티어별 일일 횟수 제한 (TIER_CONFIG.diagnoseLimit)
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TIER_CONFIG, type TierKey } from "@/lib/tier-access";
import { AI_CHARACTERS } from "@/lib/ai-characters";
import { callModel } from "@/lib/openrouter";
import { getStockPrice, getStockDailyChart, formatStockDataForAI } from "@/lib/kis";
import { getSpotPrice, getSpotKlines, formatMarketDataForAI } from "@/lib/binance";
import { STOCK_DB } from "@/lib/stock-db";

export type DiagnoseVerdict = "hold" | "buy_more" | "reduce" | "cut";

interface AIOpinion {
  characterId: string;
  verdict: DiagnoseVerdict;
  comment: string;
}

const VERDICT_VALUES: DiagnoseVerdict[] = ["hold", "buy_more", "reduce", "cut"];

function parseOpinion(raw: string): { verdict: DiagnoseVerdict; comment: string } | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const verdict = String(parsed.verdict || "").toLowerCase() as DiagnoseVerdict;
    if (!VERDICT_VALUES.includes(verdict)) return null;
    const comment = String(parsed.comment || "").slice(0, 300);
    if (!comment) return null;
    return { verdict, comment };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    // 1. 티어 확인 + 일일 한도
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    const tier = (profile?.subscription_tier || "free") as TierKey;
    const limit = TIER_CONFIG[tier].diagnoseLimit;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: usedToday } = await supabase
      .from("portfolio_diagnoses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());

    const used = usedToday || 0;
    if (Number.isFinite(limit) && used >= limit) {
      return NextResponse.json(
        {
          error: `오늘의 AI 진단 ${limit}회를 모두 사용했습니다. 업그레이드하면 더 진단받을 수 있어요.`,
          remaining: 0,
          upgrade: true,
        },
        { status: 429 }
      );
    }

    // 2. 보유종목 조회
    const { holdingId } = await request.json();
    if (!holdingId) return NextResponse.json({ error: "holdingId가 필요합니다" }, { status: 400 });

    const { data: holding } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("id", holdingId)
      .eq("user_id", user.id)
      .single();
    if (!holding) return NextResponse.json({ error: "보유종목을 찾을 수 없습니다" }, { status: 404 });

    // 3. 실시간 시세 + 차트 데이터
    let currentPrice = 0;
    let marketData = "";
    if (holding.market === "kr_stock") {
      const [price, chart] = await Promise.all([
        getStockPrice(holding.symbol),
        getStockDailyChart(holding.symbol, "D", 30).catch(() => []),
      ]);
      if (!price || !price.currentPrice || price.currentPrice <= 0) {
        return NextResponse.json({ error: "시세 조회에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
      }
      currentPrice = price.currentPrice;
      marketData = chart.length > 0 ? formatStockDataForAI(price, chart) : `현재가 ${price.currentPrice}원 (${price.changeRate}%)`;
      const meta = STOCK_DB[holding.symbol];
      if (meta) {
        marketData += `\n\n## 종목 메타\n- 투자논리: ${meta.thesis}\n- 리스크: ${meta.risks.join(", ")}\n- 밸류에이션: ${meta.valuation}`;
      }
    } else {
      const [price, klines] = await Promise.all([
        getSpotPrice(holding.symbol),
        getSpotKlines(holding.symbol, "4h", 60).catch(() => []),
      ]);
      if (!price || price <= 0) {
        return NextResponse.json({ error: "시세 조회에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
      }
      currentPrice = price;
      marketData = klines.length > 0 ? formatMarketDataForAI(klines, holding.symbol) : `현재가 ${price} USDT`;
    }

    const pnlPercent = ((currentPrice - Number(holding.avg_price)) / Number(holding.avg_price)) * 100;
    const currency = holding.market === "kr_stock" ? "원" : "USDT";

    // 4. AI 3대장 병렬 진단
    const userMessage = `## 유저 보유 현황
- 종목: ${holding.name} (${holding.symbol})
- 평단가: ${Number(holding.avg_price).toLocaleString()}${currency}
- 현재가: ${currentPrice.toLocaleString()}${currency}
- 수익률: ${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%

## 시장 데이터
${marketData}

## 요청
이 유저의 포지션에 대해 당신의 분석 관점으로 진단하세요.
반드시 아래 JSON만 출력:
\`\`\`json
{ "verdict": "hold|buy_more|reduce|cut", "comment": "한국어 2-3문장, 평단가·수익률을 직접 언급한 구체적 조언" }
\`\`\`
verdict 기준 — hold: 보유 유지 / buy_more: 추가매수 / reduce: 비중축소 / cut: 손절·전량매도`;

    const characterIds = ["claude", "gemini", "gpt"];
    const settled = await Promise.allSettled(
      characterIds.map((cid) => {
        const char = AI_CHARACTERS[cid];
        const systemPrompt = `${char.fallbackPersona}\n\n응답은 JSON만 출력. 투자자문이 아닌 참고 분석.`;
        return callModel(char.model, systemPrompt, userMessage, { maxTokens: 600, temperature: 0.5 });
      })
    );

    const opinions: AIOpinion[] = [];
    settled.forEach((result, i) => {
      if (result.status !== "fulfilled") return;
      const parsed = parseOpinion(result.value);
      if (parsed) opinions.push({ characterId: characterIds[i], ...parsed });
    });

    if (opinions.length === 0) {
      return NextResponse.json({ error: "AI 진단 생성에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
    }

    // 5. 다수결 합의 (동률이면 보수적 순서: cut > reduce > hold > buy_more)
    const tally = new Map<DiagnoseVerdict, number>();
    for (const op of opinions) tally.set(op.verdict, (tally.get(op.verdict) || 0) + 1);
    const priority: DiagnoseVerdict[] = ["cut", "reduce", "hold", "buy_more"];
    const consensus = [...tally.entries()].sort(
      (a, b) => b[1] - a[1] || priority.indexOf(a[0]) - priority.indexOf(b[0])
    )[0][0];

    const verdictLabels: Record<DiagnoseVerdict, string> = {
      hold: "보유 유지",
      buy_more: "추가매수 고려",
      reduce: "비중 축소",
      cut: "손절 검토",
    };
    const agreeCount = tally.get(consensus) || 0;
    const consensusSummary = `AI ${opinions.length}명 중 ${agreeCount}명이 '${verdictLabels[consensus]}' 의견`;

    // 6. 진단 저장 (service role)
    const serviceClient = await createServiceClient();
    const { data: saved } = await serviceClient
      .from("portfolio_diagnoses")
      .insert({
        user_id: user.id,
        holding_id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        market: holding.market,
        avg_price: holding.avg_price,
        current_price: currentPrice,
        pnl_percent: pnlPercent,
        consensus,
        consensus_summary: consensusSummary,
        ai_opinions: opinions,
      })
      .select("id, created_at")
      .single();

    const remaining = Number.isFinite(limit) ? Math.max(0, limit - used - 1) : null;

    return NextResponse.json({
      id: saved?.id,
      symbol: holding.symbol,
      name: holding.name,
      currentPrice,
      pnlPercent,
      consensus,
      consensusLabel: verdictLabels[consensus],
      consensusSummary,
      opinions,
      remaining,
      createdAt: saved?.created_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error("[portfolio/diagnose] Error:", error);
    return NextResponse.json({ error: "진단 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

// GET — 최근 진단 이력 + 오늘 남은 횟수
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.subscription_tier || "free") as TierKey;
  const limit = TIER_CONFIG[tier].diagnoseLimit;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ count: usedToday }, { data: recent }] = await Promise.all([
    supabase
      .from("portfolio_diagnoses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("portfolio_diagnoses")
      .select("id, symbol, name, market, avg_price, current_price, pnl_percent, consensus, consensus_summary, ai_opinions, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const remaining = Number.isFinite(limit) ? Math.max(0, limit - (usedToday || 0)) : null;
  return NextResponse.json({ remaining, limit: Number.isFinite(limit) ? limit : null, recent: recent || [] });
}

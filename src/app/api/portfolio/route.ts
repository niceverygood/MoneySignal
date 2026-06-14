export const maxDuration = 30;

// ============================================
// 내 보유종목 CRUD + 실시간 손익
// GET    — 보유종목 목록 + 현재가/수익률
// POST   — 종목 추가 (또는 동일 종목 평단/수량 갱신)
// DELETE — 종목 삭제 (?id=)
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMultipleStockPrices } from "@/lib/kis";
import { getMultipleSpotPrices } from "@/lib/binance";

interface Holding {
  id: string;
  market: "kr_stock" | "crypto";
  symbol: string;
  name: string;
  avg_price: number;
  quantity: number;
  created_at: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { data: holdings, error } = await supabase
    .from("portfolio_holdings")
    .select("id, market, symbol, name, avg_price, quantity, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[portfolio] fetch error:", error);
    return NextResponse.json({ error: "보유종목 조회 실패" }, { status: 500 });
  }

  const list = (holdings || []) as Holding[];

  // 현재가 일괄 조회 (시장별, 실패해도 목록은 반환)
  const krCodes = list.filter((h) => h.market === "kr_stock").map((h) => h.symbol);
  const cryptoSymbols = list.filter((h) => h.market === "crypto").map((h) => h.symbol);

  const priceMap: Record<string, number> = {};
  await Promise.all([
    (async () => {
      if (krCodes.length === 0) return;
      try {
        const prices = await getMultipleStockPrices(krCodes);
        for (const p of prices) priceMap[`kr_stock:${p.code}`] = p.currentPrice;
      } catch (e) {
        console.error("[portfolio] KIS price error:", e);
      }
    })(),
    (async () => {
      if (cryptoSymbols.length === 0) return;
      try {
        const prices = await getMultipleSpotPrices(cryptoSymbols);
        for (const [sym, price] of Object.entries(prices)) priceMap[`crypto:${sym}`] = price;
      } catch (e) {
        console.error("[portfolio] Binance price error:", e);
      }
    })(),
  ]);

  // 보유종목별 최신 AI 평결 — 개인화 진단(portfolio_diagnoses) 우선, 없으면 종목 일일합의(symbol_consensus_daily)
  const symbols = list.map((h) => h.symbol);
  // 진단 당시 평단가가 현재 평단가와 다르면 그 평결은 무효(추가매수/정정 시) → 현재 평단 기준만 채택
  const avgByKey: Record<string, number> = {};
  for (const h of list) avgByKey[`${h.market}:${h.symbol}`] = h.avg_price;
  const verdictByKey: Record<
    string,
    { source: "diagnosis" | "daily"; consensus: string; summary: string | null; date: string }
  > = {};
  if (symbols.length > 0) {
    // 일일 합의는 최근 5일 스냅샷만 평결로 사용(오래된 합의를 현재 평결로 쓰지 않음 + 윈도우 절단 방지)
    const dailyFloor = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const [diagRes, dailyRes] = await Promise.all([
      supabase
        .from("portfolio_diagnoses")
        .select("symbol, market, consensus, consensus_summary, created_at, avg_price")
        .eq("user_id", user.id)
        .in("symbol", symbols)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("symbol_consensus_daily")
        .select("symbol, market, consensus, consensus_summary, snapshot_date")
        .in("symbol", symbols)
        .gte("snapshot_date", dailyFloor)
        .order("snapshot_date", { ascending: false })
        .limit(200),
    ]);
    // 개인화 진단 — (market,symbol)별 최신 + 현재 평단가와 일치(0.5% 오차 내)하는 것만
    for (const d of diagRes.data || []) {
      const key = `${d.market}:${d.symbol}`;
      if (verdictByKey[key]) continue;
      const curAvg = avgByKey[key];
      if (curAvg == null || d.avg_price == null) continue;
      if (Math.abs(Number(d.avg_price) - curAvg) / curAvg > 0.005) continue; // 평단가 불일치 → 무효
      verdictByKey[key] = { source: "diagnosis", consensus: d.consensus, summary: d.consensus_summary, date: d.created_at };
    }
    // 일일 종목 합의 — 진단이 없는(또는 평단 변경으로 무효화된) 종목에만 폴백
    for (const s of dailyRes.data || []) {
      const key = `${s.market}:${s.symbol}`;
      if (!verdictByKey[key])
        verdictByKey[key] = { source: "daily", consensus: s.consensus, summary: s.consensus_summary, date: s.snapshot_date };
    }
  }

  const enriched = list.map((h) => {
    const currentPrice = priceMap[`${h.market}:${h.symbol}`] ?? null;
    const pnlPercent =
      currentPrice !== null ? ((currentPrice - h.avg_price) / h.avg_price) * 100 : null;
    return {
      ...h,
      current_price: currentPrice,
      pnl_percent: pnlPercent,
      verdict: verdictByKey[`${h.market}:${h.symbol}`] ?? null,
    };
  });

  // 포트폴리오 전체 요약 (평가금액 기준)
  let totalCost = 0;
  let totalValue = 0;
  for (const h of enriched) {
    if (h.current_price === null) continue;
    totalCost += h.avg_price * h.quantity;
    totalValue += h.current_price * h.quantity;
  }
  const totalPnlPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;

  return NextResponse.json({
    holdings: enriched,
    summary: { totalCost, totalValue, totalPnlPercent },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const body = await request.json();
  const market = body.market as string;
  const symbol = (body.symbol as string)?.trim();
  const name = (body.name as string)?.trim();
  const avgPrice = Number(body.avgPrice);
  const quantity = Number(body.quantity);

  if (!["kr_stock", "crypto"].includes(market) || !symbol || !name) {
    return NextResponse.json({ error: "종목 정보가 올바르지 않습니다" }, { status: 400 });
  }
  if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
    return NextResponse.json({ error: "평단가를 올바르게 입력해주세요" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "수량을 올바르게 입력해주세요" }, { status: 400 });
  }

  // 종목 수 상한 (악용 방지)
  const { count } = await supabase
    .from("portfolio_holdings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count || 0) >= 20) {
    return NextResponse.json({ error: "보유종목은 최대 20개까지 등록할 수 있습니다" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("portfolio_holdings")
    .upsert(
      {
        user_id: user.id,
        market,
        symbol,
        name,
        avg_price: avgPrice,
        quantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,market,symbol" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("[portfolio] insert error:", error);
    return NextResponse.json({ error: "종목 추가에 실패했습니다" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

  const { error } = await supabase
    .from("portfolio_holdings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[portfolio] delete error:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

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

  const enriched = list.map((h) => {
    const currentPrice = priceMap[`${h.market}:${h.symbol}`] ?? null;
    const pnlPercent =
      currentPrice !== null ? ((currentPrice - h.avg_price) / h.avg_price) * 100 : null;
    return { ...h, current_price: currentPrice, pnl_percent: pnlPercent };
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

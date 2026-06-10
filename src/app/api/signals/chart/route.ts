export const maxDuration = 30;

// ============================================
// 시그널 차트 데이터 — 카테고리별 캔들 정규화
// GET /api/signals/chart?id=<signalId>
// coin_spot   → Binance 현물 1h 클라인
// coin_futures → Binance 선물 1h 클라인
// kr_stock    → KIS 일봉 60개
// overseas_futures → 미지원 (supported: false)
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpotKlines, getFuturesKlines } from "@/lib/binance";
import { getStockDailyChart } from "@/lib/kis";

// lightweight-charts 형식: time은 unix초(인트라데이) 또는 "YYYY-MM-DD"(일봉)
interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

    const { data: signal } = await supabase
      .from("signals")
      .select("id, symbol, category")
      .eq("id", id)
      .single();
    if (!signal) return NextResponse.json({ error: "시그널을 찾을 수 없습니다" }, { status: 404 });

    let candles: Candle[] = [];
    let interval = "";

    if (signal.category === "coin_spot" || signal.category === "coin_futures") {
      const klines =
        signal.category === "coin_futures"
          ? await getFuturesKlines(signal.symbol, "1h", 168)
          : await getSpotKlines(signal.symbol, "1h", 168);
      candles = klines.map((k) => ({
        time: Math.floor(k.openTime / 1000),
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
      }));
      interval = "1시간봉 · 최근 7일";
    } else if (signal.category === "kr_stock") {
      const daily = await getStockDailyChart(signal.symbol, "D", 60);
      candles = daily
        .filter((d) => d.open > 0 && d.close > 0)
        .map((d) => ({
          // KIS date: YYYYMMDD → lightweight-charts business day 형식
          time: `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
        // KIS는 최신순으로 줄 수 있음 — 차트는 오름차순 필수
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));
      interval = "일봉 · 최근 60거래일";
    } else {
      return NextResponse.json({ supported: false, candles: [], interval: "" });
    }

    if (candles.length === 0) {
      return NextResponse.json({ supported: false, candles: [], interval: "" });
    }

    return NextResponse.json({ supported: true, candles, interval });
  } catch (error) {
    console.error("[signals/chart] Error:", error);
    return NextResponse.json({ error: "차트 데이터 조회 실패" }, { status: 500 });
  }
}

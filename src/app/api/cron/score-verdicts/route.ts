export const maxDuration = 60;

// ============================================
// AI 적중률 채점 크론
// verdict_picks의 발행가 대비 1/7/30일 수익률을 매일 채점
// (해당 기간이 경과했고 아직 채점 안 된 픽만)
// 매일 16:00 KST (07:00 UTC) — 장 마감 후
// ============================================
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getMultipleStockPrices } from "@/lib/kis";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

const HORIZONS = [
  { key: "1d", days: 1 },
  { key: "7d", days: 7 },
  { key: "30d", days: 30 },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function ageDays(verdictDate: string, now: number): number {
  // KST 자정 기준 경과일
  const emitted = new Date(`${verdictDate}T00:00:00+09:00`).getTime();
  return (now - emitted) / DAY_MS;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = Date.now();
  const since = new Date(now - 35 * DAY_MS).toISOString().slice(0, 10);

  // 발행가가 있고, 최근 35일 이내 픽
  const { data: picks, error } = await supabase
    .from("verdict_picks")
    .select("*")
    .gte("verdict_date", since)
    .not("entry_price", "is", null);

  if (error) {
    console.error("[score-verdicts] fetch error:", error);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  // 채점이 필요한 픽 (어떤 horizon이든 기간 경과 & 미채점)
  const needing = (picks || []).filter((p) =>
    HORIZONS.some(
      (h) =>
        ageDays(p.verdict_date, now) >= h.days &&
        (p as Record<string, unknown>)[`price_${h.key}`] == null
    )
  );

  if (needing.length === 0) {
    return NextResponse.json({ scored: 0, reason: "nothing due" });
  }

  // 필요한 종목코드 현재가 일괄 조회
  const codes = [...new Set(needing.map((p) => p.symbol))].filter((s) => /^\d{6}$/.test(s));
  const priceMap: Record<string, number> = {};
  try {
    const prices = await getMultipleStockPrices(codes);
    for (const p of prices) priceMap[p.code] = p.currentPrice;
  } catch (e) {
    console.error("[score-verdicts] KIS price fetch failed:", e);
    return NextResponse.json({ scored: 0, error: "price fetch failed" }, { status: 502 });
  }

  let scored = 0;
  for (const p of needing) {
    const cur = priceMap[p.symbol];
    const entry = Number(p.entry_price);
    if (!cur || cur <= 0 || !entry || entry <= 0) continue;

    const update: Record<string, number | string> = {};
    for (const h of HORIZONS) {
      const priceKey = `price_${h.key}`;
      if (
        ageDays(p.verdict_date, now) >= h.days &&
        (p as Record<string, unknown>)[priceKey] == null
      ) {
        update[priceKey] = cur;
        update[`return_${h.key}`] = ((cur - entry) / entry) * 100;
      }
    }
    if (Object.keys(update).length > 0) {
      update.scored_at = new Date(now).toISOString();
      await supabase.from("verdict_picks").update(update).eq("id", p.id);
      scored++;
    }
  }

  console.log(`[score-verdicts] scored ${scored} picks`);
  return NextResponse.json({ scored, candidates: needing.length });
}

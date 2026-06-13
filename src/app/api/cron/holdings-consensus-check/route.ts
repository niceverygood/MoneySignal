export const maxDuration = 300;

// ============================================
// 내 종목 합의 변화 알림 루프 (Pillar 3)
//   매 영업일 장 마감 후 1회:
//   1) 유저들이 보유 중인 종목을 수집 (보유자 수 desc)
//   2) 비용 가드 — "푸시 토큰이 있는 유저가 1명 이상 보유한" 종목만,
//      그중 상위 MAX_SYMBOLS개 (env HOLDINGS_CONSENSUS_MAX, 기본 20)만 처리
//   3) 종목당 AI 합의 1회만 호출 → 전 보유자 공유 (유저 수와 무관하게 비용 일정)
//   4) 어제 스냅샷과 비교해 합의가 바뀐 종목만 → 해당 보유자 전원에게 푸시+알림
//   5) 오늘 스냅샷 저장 (UNIQUE(market,symbol,date) → 재실행 멱등)
//
//   비용 상한 = MAX_SYMBOLS × 3 AI호출 (기본 60회/일). 유저 수가 늘어도 불변.
// ============================================
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push";
import {
  getStockConsensus,
  STOCK_VERDICT_LABELS,
  type StockVerdict,
} from "@/lib/stock-consensus";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

const DEFAULT_MAX_SYMBOLS = 20;

// 합의 전환의 "방향성" — 알림 문구를 위해
function changeTone(prev: StockVerdict, next: StockVerdict): {
  emoji: string;
  headline: string;
} {
  const rank: Record<StockVerdict, number> = { sell: 0, hold: 1, buy: 2 };
  if (rank[next] > rank[prev]) return { emoji: "📈", headline: "긍정적으로 바뀌었어요" };
  if (rank[next] < rank[prev]) return { emoji: "⚠️", headline: "신중해졌어요" };
  return { emoji: "🔄", headline: "바뀌었어요" };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxSymbols = Number(process.env.HOLDINGS_CONSENSUS_MAX) || DEFAULT_MAX_SYMBOLS;
  const supabase = await createServiceClient();

  // 오늘/어제 날짜 (KST 기준 날짜 문자열)
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10);
  const yesterday = new Date(nowKst.getTime() - 24 * 3600 * 1000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  try {
    // 1) 전체 보유 종목 + 보유자 매핑
    const { data: holdings, error: hErr } = await supabase
      .from("portfolio_holdings")
      .select("market, symbol, name, user_id");
    if (hErr) throw hErr;
    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, reason: "no_holdings" });
    }

    // 종목별 보유자 집계
    type SymInfo = { market: string; symbol: string; name: string; users: Set<string> };
    const symMap = new Map<string, SymInfo>();
    for (const h of holdings) {
      const key = `${h.market}:${h.symbol}`;
      if (!symMap.has(key))
        symMap.set(key, { market: h.market, symbol: h.symbol, name: h.name, users: new Set() });
      symMap.get(key)!.users.add(h.user_id);
    }

    // 2) 비용 가드 — 푸시 토큰 보유 유저 집합
    const allUserIds = [...new Set(holdings.map((h) => h.user_id))];
    const { data: tokenRows } = await supabase
      .from("push_tokens")
      .select("user_id")
      .in("user_id", allUserIds);
    const pushableUsers = new Set((tokenRows || []).map((t) => t.user_id));

    // 푸시 받을 수 있는 보유자가 1명 이상인 종목만, 보유자 수 desc, 상위 N개
    const candidates = [...symMap.values()]
      .map((s) => ({ ...s, pushable: [...s.users].filter((u) => pushableUsers.has(u)) }))
      .filter((s) => s.pushable.length > 0)
      .sort((a, b) => b.users.size - a.users.size)
      .slice(0, maxSymbols);

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, reason: "no_pushable_holders" });
    }

    // 3) 어제 스냅샷 일괄 조회
    const { data: prevSnaps } = await supabase
      .from("symbol_consensus_daily")
      .select("market, symbol, consensus")
      .eq("snapshot_date", yesterdayStr);
    const prevMap = new Map<string, StockVerdict>();
    for (const p of prevSnaps || []) prevMap.set(`${p.market}:${p.symbol}`, p.consensus as StockVerdict);

    let processed = 0;
    let changed = 0;
    let notified = 0;
    const errors: string[] = [];

    // 4) 종목별 순차 처리 (AI 호출 동시성 제한 = 비용/레이트 안전)
    for (const c of candidates) {
      const key = `${c.market}:${c.symbol}`;
      try {
        const result = await getStockConsensus(c.market, c.symbol, c.name);
        if (!result) {
          errors.push(`${key}: consensus_failed`);
          continue;
        }
        processed++;

        // 오늘 스냅샷 저장 (멱등)
        await supabase.from("symbol_consensus_daily").upsert(
          {
            market: c.market,
            symbol: c.symbol,
            name: c.name,
            snapshot_date: todayStr,
            consensus: result.consensus,
            consensus_summary: result.consensusSummary,
            current_price: result.currentPrice,
            ai_opinions: result.opinions,
          },
          { onConflict: "market,symbol,snapshot_date" }
        );

        // 어제 대비 변화 감지
        const prev = prevMap.get(key);
        if (!prev || prev === result.consensus) continue;
        changed++;

        const tone = changeTone(prev, result.consensus);
        const title = `${tone.emoji} ${c.name} AI 합의가 ${tone.headline}`;
        const body = `${STOCK_VERDICT_LABELS[prev]} → ${STOCK_VERDICT_LABELS[result.consensus]} · ${result.consensusSummary}`;

        // 알림 받을 대상 = 이 종목 보유 + 푸시 가능 유저
        const recipients = c.pushable;

        // in-app 알림 레코드
        const notifRows = recipients.map((uid) => ({
          user_id: uid,
          type: "consensus_change",
          title,
          body,
        }));
        if (notifRows.length > 0) {
          await supabase.from("notifications").insert(notifRows);
        }

        // 푸시 발송
        const { sent } = await sendPushToUsers(supabase, recipients, {
          title,
          body,
          data: { type: "consensus_change", market: c.market, symbol: c.symbol },
        });
        notified += sent;
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    return NextResponse.json({
      ok: true,
      date: todayStr,
      candidates: candidates.length,
      processed,
      changed,
      notified,
      maxSymbols,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("[cron/holdings-consensus-check] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "internal_error" },
      { status: 500 }
    );
  }
}

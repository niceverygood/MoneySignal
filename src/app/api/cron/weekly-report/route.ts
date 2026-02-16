import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/claude";

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === process.env.CRON_SECRET;
}

interface CategoryStats {
  total: number;
  wins: number;
  winRate: number;
  avgPnl: number;
  bestSignal: { symbol: string; symbol_name: string; pnl: number } | null;
  worstSignal: { symbol: string; symbol_name: string; pnl: number } | null;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();

    // Query signals from last 7 days that are closed
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const closedStatuses = ["hit_tp1", "hit_tp2", "hit_tp3", "hit_sl", "expired"];

    const { data: signals, error: signalsError } = await supabase
      .from("signals")
      .select("*")
      .gte("created_at", sevenDaysAgo)
      .in("status", closedStatuses);

    if (signalsError) {
      console.error("[Weekly Report] Failed to fetch signals:", signalsError);
      return NextResponse.json({ error: signalsError.message }, { status: 500 });
    }

    // Calculate per-category stats
    const categoryMap: Record<string, typeof signals> = {};
    for (const signal of signals || []) {
      if (!categoryMap[signal.category]) {
        categoryMap[signal.category] = [];
      }
      categoryMap[signal.category].push(signal);
    }

    const performanceData: Record<string, CategoryStats> = {};
    const categoryLabels: Record<string, string> = {
      coin_spot: "코인 현물",
      coin_futures: "코인 선물",
      overseas_futures: "해외선물",
      kr_stock: "국내주식",
    };

    for (const [category, catSignals] of Object.entries(categoryMap)) {
      const wins = catSignals.filter((s) =>
        ["hit_tp1", "hit_tp2", "hit_tp3"].includes(s.status)
      );
      const pnls = catSignals
        .filter((s) => s.result_pnl_percent != null)
        .map((s) => ({ symbol: s.symbol, symbol_name: s.symbol_name, pnl: s.result_pnl_percent as number }));

      const avgPnl = pnls.length > 0 ? pnls.reduce((sum, p) => sum + p.pnl, 0) / pnls.length : 0;
      const sorted = [...pnls].sort((a, b) => b.pnl - a.pnl);

      performanceData[category] = {
        total: catSignals.length,
        wins: wins.length,
        winRate: catSignals.length > 0 ? Math.round((wins.length / catSignals.length) * 100) : 0,
        avgPnl: Math.round(avgPnl * 100) / 100,
        bestSignal: sorted.length > 0 ? sorted[0] : null,
        worstSignal: sorted.length > 0 ? sorted[sorted.length - 1] : null,
      };
    }

    // Overall stats
    const totalSignals = signals?.length || 0;
    const totalWins = Object.values(performanceData).reduce((sum, s) => sum + s.wins, 0);
    const overallWinRate = totalSignals > 0 ? Math.round((totalWins / totalSignals) * 100) : 0;

    // Build performance summary for AI
    const perfSummary = Object.entries(performanceData)
      .map(([cat, stats]) => {
        const label = categoryLabels[cat] || cat;
        return `${label}: 총 ${stats.total}건, 승률 ${stats.winRate}%, 평균 수익률 ${stats.avgPnl}%` +
          (stats.bestSignal ? `, 최고 ${stats.bestSignal.symbol_name}(${stats.bestSignal.pnl > 0 ? "+" : ""}${stats.bestSignal.pnl}%)` : "") +
          (stats.worstSignal ? `, 최저 ${stats.worstSignal.symbol_name}(${stats.worstSignal.pnl > 0 ? "+" : ""}${stats.worstSignal.pnl}%)` : "");
      })
      .join("\n");

    const systemPrompt = "너는 머니시그널의 수석 AI 애널리스트야. 지난 주 시그널 성과와 시장 상황을 바탕으로 이번 주 전망 리포트를 작성해. 포함: 1) 지난 주 성과 요약 2) 주요 시장 이벤트 3) 이번 주 주목 이벤트 4) 카테고리별 전략 5) Top 3 주목 종목. 마크다운, 한국어, 1500자 이내.";

    const userMessage = `지난 7일간 시그널 성과 데이터:

전체: ${totalSignals}건, 승률 ${overallWinRate}%

카테고리별:
${perfSummary || "데이터 없음"}

이 데이터를 기반으로 이번 주 전망 리포트를 작성해줘.`;

    const reportContent = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], {
      maxTokens: 4000,
      temperature: 0.7,
    });

    // Generate title and summary
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date();
    const title = `주간 AI 마켓 리포트 (${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()})`;
    const summary = `전체 ${totalSignals}건 | 승률 ${overallWinRate}% | ` +
      Object.entries(performanceData)
        .map(([cat, s]) => `${categoryLabels[cat] || cat} ${s.winRate}%`)
        .join(" · ");

    // Save to market_reports
    const { data: report, error: insertError } = await supabase
      .from("market_reports")
      .insert({
        type: "weekly",
        title,
        content: reportContent,
        summary,
        performance_data: performanceData,
        min_tier_required: "pro",
        week_start: weekStart.toISOString().split("T")[0],
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Weekly Report] Failed to save report:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log("[Weekly Report] Generated successfully:", report.id);

    return NextResponse.json({
      success: true,
      reportId: report.id,
      title,
      summary,
      totalSignals,
      overallWinRate,
      performanceData,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Weekly Report] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

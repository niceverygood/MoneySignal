import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/claude";

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();

    // Query today's signals
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: signals, error: signalsError } = await supabase
      .from("signals")
      .select("*")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    if (signalsError) {
      console.error("[Daily Briefing] Failed to fetch signals:", signalsError);
      return NextResponse.json({ error: signalsError.message }, { status: 500 });
    }

    // Calculate today's stats
    const totalToday = signals?.length || 0;
    const activeCount = signals?.filter((s) => s.status === "active").length || 0;
    const closedSignals = signals?.filter((s) => s.status !== "active") || [];
    const wins = closedSignals.filter((s) =>
      ["hit_tp1", "hit_tp2", "hit_tp3"].includes(s.status)
    );

    const categoryLabels: Record<string, string> = {
      coin_spot: "코인 현물",
      coin_futures: "코인 선물",
      overseas_futures: "해외선물",
      kr_stock: "국내주식",
    };

    const categoryCounts: Record<string, number> = {};
    for (const signal of signals || []) {
      categoryCounts[signal.category] = (categoryCounts[signal.category] || 0) + 1;
    }

    const categoryBreakdown = Object.entries(categoryCounts)
      .map(([cat, count]) => `${categoryLabels[cat] || cat}: ${count}건`)
      .join(", ");

    // Top confidence signals
    const topSignals = [...(signals || [])]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((s) => `${s.symbol_name}(${s.direction}, 신뢰도 ${s.confidence})`)
      .join(", ");

    const systemPrompt = "너는 머니시그널의 AI 브리핑 담당이야. 오늘의 시그널 현황을 간결하게 요약해줘. 핵심 포인트만, 500자 이내, 마크다운, 한국어.";

    const userMessage = `오늘의 시그널 현황:
- 총 발행: ${totalToday}건 (활성 ${activeCount}건)
- 카테고리별: ${categoryBreakdown || "데이터 없음"}
- 완료 시그널: ${closedSignals.length}건 중 ${wins.length}건 적중
- 주요 시그널: ${topSignals || "없음"}

간결한 일일 브리핑을 작성해줘.`;

    const briefingContent = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], {
      maxTokens: 1500,
      temperature: 0.6,
    });

    // Generate title and summary
    const today = new Date();
    const title = `일일 AI 브리핑 (${today.getMonth() + 1}/${today.getDate()})`;
    const summary = `오늘 ${totalToday}건 발행 | 활성 ${activeCount}건 | ${categoryBreakdown}`;

    // Save to market_reports
    const { data: report, error: insertError } = await supabase
      .from("market_reports")
      .insert({
        type: "daily_briefing",
        title,
        content: briefingContent,
        summary,
        performance_data: {
          totalToday,
          activeCount,
          closedCount: closedSignals.length,
          winsCount: wins.length,
          categoryCounts,
        },
        min_tier_required: "premium",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Daily Briefing] Failed to save report:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log("[Daily Briefing] Generated successfully:", report.id);

    return NextResponse.json({
      success: true,
      reportId: report.id,
      title,
      summary,
      totalToday,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Daily Briefing] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

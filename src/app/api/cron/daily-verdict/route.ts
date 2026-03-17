export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scanTopStocks } from "@/lib/kis";
import { generateDailyVerdict } from "@/lib/multi-consensus";

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

  const supabase = await createServiceClient();

  // 활성 유저 체크 (비용 절감)
  const { count: activeUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("last_active_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (!activeUsers) {
    return NextResponse.json({ skipped: true, reason: "no active users in 24h" });
  }

  const today = new Date().toISOString().slice(0, 10);

  // 오늘 이미 생성됐으면 스킵 (force 파라미터로 우회 가능)
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  if (!force) {
    const { data: existing } = await supabase
      .from("verdicts")
      .select("id")
      .eq("date", today)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ skipped: true, reason: "already generated today", date: today });
    }
  }

  try {
    // KIS API로 주가 데이터 수집
    console.log("[DailyVerdict] Fetching KIS stock data...");
    let marketData: string;
    try {
      const { formatted } = await scanTopStocks();
      marketData = formatted;
    } catch (e) {
      console.error("[DailyVerdict] KIS API failed:", e);
      marketData = "KIS API 데이터를 가져올 수 없습니다. 최근 시장 상황을 기반으로 분석해주세요.";
    }

    // 3-AI 합의 생성
    console.log("[DailyVerdict] Generating 3-AI consensus...");
    const verdict = await generateDailyVerdict(marketData);

    // DB 저장
    const { data, error } = await supabase
      .from("verdicts")
      .insert({
        date: today,
        top5: verdict.top5,
        claude_top5: verdict.claudeTop5,
        gemini_top5: verdict.geminiTop5,
        gpt_top5: verdict.gptTop5,
        theme_name: verdict.theme.name,
        theme_emoji: verdict.theme.emoji,
        sentiment_score: verdict.sentiment.compositeScore,
        sentiment_label: verdict.sentiment.label,
        buy_weight: verdict.sentiment.buyWeight,
        consensus_summary: verdict.consensusSummary,
      })
      .select()
      .single();

    if (error) {
      console.error("[DailyVerdict] DB error:", error);
      return NextResponse.json({ error: "Failed to save verdict" }, { status: 500 });
    }

    console.log(`[DailyVerdict] Saved verdict for ${today}: ${verdict.top5.map(t => t.name).join(", ")}`);

    return NextResponse.json({
      success: true,
      date: today,
      verdict: data,
      top5: verdict.top5.map(t => ({
        rank: t.rank,
        name: t.name,
        avgScore: t.avgScore.toFixed(1),
        isUnanimous: t.isUnanimous,
        votedBy: t.votedBy,
      })),
      theme: verdict.theme,
      sentiment: verdict.sentiment,
    });
  } catch (error) {
    console.error("[DailyVerdict] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate daily verdict" },
      { status: 500 }
    );
  }
}

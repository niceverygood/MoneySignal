import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TIER_CONFIG, type TierKey } from "@/lib/tier-access";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const category = searchParams.get("category") || "all";
  const requestedPeriod = parseInt(searchParams.get("period") || "90");

  // Get user auth and subscription tier
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userTier: TierKey = "free";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    if (profile?.subscription_tier) {
      userTier = profile.subscription_tier as TierKey;
    }
  }

  // Apply tier-based period limit
  const tierConfig = TIER_CONFIG[userTier];
  const maxPeriodDays =
    tierConfig.backtestPeriodDays === Infinity
      ? requestedPeriod
      : tierConfig.backtestPeriodDays;
  const effectivePeriod = Math.min(requestedPeriod, maxPeriodDays);

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - effectivePeriod);

  // Fetch backtest results
  let query = supabase
    .from("backtest_results")
    .select("*")
    .gte("period_end", periodStart.toISOString().split("T")[0])
    .order("period_end", { ascending: false });

  if (category !== "all") {
    query = query.eq("category", category);
  }

  const { data: backtestResults, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch recent closed signals for history table
  let signalsQuery = supabase
    .from("signals")
    .select("*")
    .neq("status", "active")
    .gte("created_at", periodStart.toISOString())
    .order("closed_at", { ascending: false })
    .limit(100);

  if (category !== "all") {
    signalsQuery = signalsQuery.eq("category", category);
  }

  const { data: recentSignals } = await signalsQuery;

  // Calculate aggregate stats
  const closedSignals = recentSignals || [];
  const winningSignals = closedSignals.filter(
    (s) => s.result_pnl_percent && Number(s.result_pnl_percent) > 0
  );

  const totalPnl = closedSignals.reduce(
    (sum, s) => sum + (Number(s.result_pnl_percent) || 0),
    0
  );

  const avgProfit =
    winningSignals.length > 0
      ? winningSignals.reduce(
          (sum, s) => sum + (Number(s.result_pnl_percent) || 0),
          0
        ) / winningSignals.length
      : 0;

  const losingSignals = closedSignals.filter(
    (s) => s.result_pnl_percent && Number(s.result_pnl_percent) < 0
  );
  const avgLoss =
    losingSignals.length > 0
      ? losingSignals.reduce(
          (sum, s) => sum + (Number(s.result_pnl_percent) || 0),
          0
        ) / losingSignals.length
      : 0;

  return NextResponse.json({
    backtestResults: backtestResults || [],
    recentSignals: closedSignals,
    aggregateStats: {
      totalSignals: closedSignals.length,
      winningSignals: winningSignals.length,
      winRate:
        closedSignals.length > 0
          ? (winningSignals.length / closedSignals.length) * 100
          : 0,
      avgProfit: Math.round(avgProfit * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      profitFactor:
        Math.abs(avgLoss) > 0
          ? Math.round((avgProfit / Math.abs(avgLoss)) * 100) / 100
          : 0,
    },
    userTier,
    maxPeriodDays:
      tierConfig.backtestPeriodDays === Infinity
        ? null
        : tierConfig.backtestPeriodDays,
  });
}

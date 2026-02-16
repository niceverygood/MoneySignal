import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type TierKey } from "@/lib/tier-access";

export async function GET() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  // Get user tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier: TierKey = (profile?.subscription_tier as TierKey) || "free";

  // Free tier: no data
  if (tier === "free") {
    return NextResponse.json({
      tier,
      stats: {
        totalFollowed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgPnl: 0,
        totalPnl: 0,
      },
      monthlyBreakdown: [],
      categoryBreakdown: [],
      cumulativePnl: [],
      follows: [],
    });
  }

  // Query user_signal_follows joined with signals
  const { data: follows, error } = await supabase
    .from("user_signal_follows")
    .select(
      `
      id,
      signal_id,
      followed_at,
      entry_price_actual,
      exit_price_actual,
      actual_pnl_percent,
      notes,
      signals (
        symbol,
        symbol_name,
        category,
        direction,
        result_pnl_percent,
        closed_at,
        status,
        created_at
      )
    `
    )
    .eq("user_id", user.id)
    .order("followed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const followsList = follows || [];

  // Calculate stats
  const withPnl = followsList.filter((f) => {
    const sig = f.signals as unknown as Record<string, unknown> | null;
    const pnl = f.actual_pnl_percent ?? sig?.result_pnl_percent;
    return pnl !== null && pnl !== undefined;
  });

  const getPnl = (f: (typeof followsList)[number]): number => {
    return Number(
      f.actual_pnl_percent ??
        (f.signals as unknown as Record<string, unknown> | null)?.result_pnl_percent ??
        0
    );
  };

  const wins = withPnl.filter((f) => getPnl(f) > 0);
  const losses = withPnl.filter((f) => getPnl(f) < 0);
  const totalPnl = withPnl.reduce((sum, f) => sum + getPnl(f), 0);
  const avgPnl = withPnl.length > 0 ? totalPnl / withPnl.length : 0;
  const winRate =
    withPnl.length > 0 ? (wins.length / withPnl.length) * 100 : 0;

  const stats = {
    totalFollowed: followsList.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round(winRate * 100) / 100,
    avgPnl: Math.round(avgPnl * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
  };

  // Monthly breakdown (pro+)
  let monthlyBreakdown: { month: string; pnl: number; count: number }[] = [];
  const isProPlus = tier === "pro" || tier === "premium" || tier === "bundle";

  if (isProPlus && withPnl.length > 0) {
    const monthMap = new Map<string, { pnl: number; count: number }>();
    for (const f of withPnl) {
      const date = new Date(f.followed_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(monthKey) || { pnl: 0, count: 0 };
      existing.pnl += getPnl(f);
      existing.count += 1;
      monthMap.set(monthKey, existing);
    }
    monthlyBreakdown = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        pnl: Math.round(data.pnl * 100) / 100,
        count: data.count,
      }));
  }

  // Category breakdown (pro+)
  let categoryBreakdown: { category: string; count: number; pnl: number }[] =
    [];
  if (isProPlus && followsList.length > 0) {
    const catMap = new Map<string, { count: number; pnl: number }>();
    for (const f of followsList) {
      const sig = f.signals as unknown as Record<string, unknown> | null;
      const cat = (sig?.category as string) || "unknown";
      const existing = catMap.get(cat) || { count: 0, pnl: 0 };
      existing.count += 1;
      existing.pnl += getPnl(f);
      catMap.set(cat, existing);
    }
    categoryBreakdown = Array.from(catMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      pnl: Math.round(data.pnl * 100) / 100,
    }));
  }

  // Cumulative PnL (premium+)
  let cumulativePnl: { date: string; pnl: number }[] = [];
  const isPremiumPlus = tier === "premium" || tier === "bundle";

  if (isPremiumPlus && withPnl.length > 0) {
    const sorted = [...withPnl].sort(
      (a, b) =>
        new Date(a.followed_at).getTime() - new Date(b.followed_at).getTime()
    );
    let cumulative = 0;
    cumulativePnl = sorted.map((f) => {
      cumulative += getPnl(f);
      return {
        date: new Date(f.followed_at).toISOString().split("T")[0],
        pnl: Math.round(cumulative * 100) / 100,
      };
    });
  }

  return NextResponse.json({
    tier,
    stats,
    monthlyBreakdown,
    categoryBreakdown,
    cumulativePnl,
    follows: followsList.map((f) => ({
      id: f.id,
      signal_id: f.signal_id,
      followed_at: f.followed_at,
      actual_pnl_percent: f.actual_pnl_percent,
      signals: f.signals,
    })),
  });
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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
  const categories = ["coin_spot", "coin_futures", "overseas_futures", "kr_stock"];
  const results: Record<string, unknown> = {};

  for (const category of categories) {
    try {
      // Fetch all closed signals for this category
      const { data: signals } = await supabase
        .from("signals")
        .select("*")
        .eq("category", category)
        .neq("status", "active")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });

      if (!signals || signals.length === 0) {
        results[category] = { message: "No closed signals" };
        continue;
      }

      // Calculate overall stats
      const winningSignals = signals.filter(
        (s) => s.result_pnl_percent && Number(s.result_pnl_percent) > 0
      );
      const losingSignals = signals.filter(
        (s) => s.result_pnl_percent && Number(s.result_pnl_percent) < 0
      );

      const winRate = (winningSignals.length / signals.length) * 100;

      const avgProfit =
        winningSignals.length > 0
          ? winningSignals.reduce(
              (sum, s) => sum + Number(s.result_pnl_percent || 0),
              0
            ) / winningSignals.length
          : 0;

      const avgLoss =
        losingSignals.length > 0
          ? losingSignals.reduce(
              (sum, s) => sum + Number(s.result_pnl_percent || 0),
              0
            ) / losingSignals.length
          : 0;

      const totalPnl = signals.reduce(
        (sum, s) => sum + Number(s.result_pnl_percent || 0),
        0
      );

      const totalProfit = winningSignals.reduce(
        (sum, s) => sum + Number(s.result_pnl_percent || 0),
        0
      );
      const totalLoss = Math.abs(
        losingSignals.reduce(
          (sum, s) => sum + Number(s.result_pnl_percent || 0),
          0
        )
      );
      const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

      // Calculate max drawdown
      let maxDrawdown = 0;
      let peak = 0;
      let cumPnl = 0;
      for (const signal of signals) {
        cumPnl += Number(signal.result_pnl_percent || 0);
        if (cumPnl > peak) peak = cumPnl;
        const drawdown = peak - cumPnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      // Generate monthly breakdown
      const monthlyMap: Record<string, { signals: number; wins: number; pnl: number }> = {};
      for (const signal of signals) {
        const month = signal.closed_at
          ? signal.closed_at.substring(0, 7)
          : signal.created_at.substring(0, 7);

        if (!monthlyMap[month]) {
          monthlyMap[month] = { signals: 0, wins: 0, pnl: 0 };
        }
        monthlyMap[month].signals++;
        if (Number(signal.result_pnl_percent || 0) > 0) {
          monthlyMap[month].wins++;
        }
        monthlyMap[month].pnl += Number(signal.result_pnl_percent || 0);
      }

      const monthlyBreakdown = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          signals: data.signals,
          winRate: data.signals > 0
            ? Math.round((data.wins / data.signals) * 10000) / 100
            : 0,
          pnl: Math.round(data.pnl * 100) / 100,
        }));

      // Get period bounds
      const periodStart = signals[0].created_at.split("T")[0];
      const periodEnd = signals[signals.length - 1].closed_at?.split("T")[0] ||
        new Date().toISOString().split("T")[0];

      // Upsert backtest result
      const { error } = await supabase
        .from("backtest_results")
        .upsert(
          {
            category,
            period_start: periodStart,
            period_end: periodEnd,
            total_signals: signals.length,
            winning_signals: winningSignals.length,
            win_rate: Math.round(winRate * 100) / 100,
            avg_profit_percent: Math.round(avgProfit * 100) / 100,
            avg_loss_percent: Math.round(avgLoss * 100) / 100,
            max_drawdown_percent: Math.round(maxDrawdown * 100) / 100,
            profit_factor: Math.round(profitFactor * 100) / 100,
            total_pnl_percent: Math.round(totalPnl * 100) / 100,
            monthly_breakdown: monthlyBreakdown,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "category,period_start,period_end" }
        );

      if (error) {
        console.error(`Error upserting backtest for ${category}:`, error);
        results[category] = { error: error.message };
      } else {
        results[category] = {
          totalSignals: signals.length,
          winRate: Math.round(winRate * 100) / 100,
          totalPnl: Math.round(totalPnl * 100) / 100,
        };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      results[category] = { error: msg };
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}

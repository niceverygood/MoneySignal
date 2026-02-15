/**
 * Seed Script for MoneySignal
 * Run: npx tsx scripts/seed.ts
 *
 * Make sure to set environment variables:
 *  NEXT_PUBLIC_SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("🌱 Seeding MoneySignal database...\n");

  // 1. Create test signals (50 signals with various statuses)
  console.log("📊 Creating test signals...");
  const signalCategories = ["coin_spot", "coin_futures", "overseas_futures", "kr_stock"];
  const statuses = ["active", "hit_tp1", "hit_tp2", "hit_tp3", "hit_sl", "expired"];
  const symbols = [
    { symbol: "BTCUSDT", name: "Bitcoin", cat: "coin_spot" },
    { symbol: "ETHUSDT", name: "Ethereum", cat: "coin_spot" },
    { symbol: "SOLUSDT", name: "Solana", cat: "coin_spot" },
    { symbol: "BTCUSDT", name: "Bitcoin", cat: "coin_futures" },
    { symbol: "ETHUSDT", name: "Ethereum", cat: "coin_futures" },
    { symbol: "NQ", name: "나스닥100 선물", cat: "overseas_futures" },
    { symbol: "ES", name: "S&P500 선물", cat: "overseas_futures" },
    { symbol: "GC", name: "금 선물", cat: "overseas_futures" },
    { symbol: "005930", name: "삼성전자", cat: "kr_stock" },
    { symbol: "000660", name: "SK하이닉스", cat: "kr_stock" },
    { symbol: "035720", name: "카카오", cat: "kr_stock" },
  ];

  const signals: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 50; i++) {
    const sym = symbols[i % symbols.length];
    const status = i < 5 ? "active" : statuses[Math.floor(Math.random() * statuses.length)];
    const isLong = Math.random() > 0.4;
    const basePrice = sym.cat === "kr_stock" ? 50000 + Math.random() * 100000 : 1000 + Math.random() * 100000;
    const pnl = status === "active" ? null :
      status === "hit_tp1" ? 2 + Math.random() * 3 :
      status === "hit_tp2" ? 5 + Math.random() * 5 :
      status === "hit_tp3" ? 10 + Math.random() * 10 :
      status === "hit_sl" ? -(1 + Math.random() * 3) :
      Math.random() > 0.5 ? Math.random() * 3 : -(Math.random() * 2);

    const daysAgo = i < 5 ? 0 : Math.floor(Math.random() * 90);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    signals.push({
      category: sym.cat,
      symbol: sym.symbol,
      symbol_name: sym.name,
      direction: isLong ? (sym.cat.includes("coin") ? "long" : "buy") : (sym.cat.includes("coin") ? "short" : "sell"),
      entry_price: Math.round(basePrice * 100) / 100,
      stop_loss: Math.round(basePrice * (isLong ? 0.97 : 1.03) * 100) / 100,
      take_profit_1: Math.round(basePrice * (isLong ? 1.03 : 0.97) * 100) / 100,
      take_profit_2: Math.round(basePrice * (isLong ? 1.07 : 0.93) * 100) / 100,
      take_profit_3: Math.round(basePrice * (isLong ? 1.12 : 0.88) * 100) / 100,
      leverage_conservative: sym.cat === "coin_futures" ? 10 : null,
      leverage_aggressive: sym.cat === "coin_futures" ? 20 : null,
      confidence: Math.floor(Math.random() * 3) + 3,
      timeframe: ["4h", "1d", "1w"][Math.floor(Math.random() * 3)],
      valid_until: new Date(createdAt.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      ai_reasoning: `AI 3대장 합의: ${sym.name}의 기술적 분석과 펀더멘털 검토 결과, ${isLong ? "상승" : "하락"} 추세가 감지되었습니다. RSI, MACD, 볼린저밴드 등 주요 지표가 ${isLong ? "매수" : "매도"} 시그널을 보이고 있습니다.`,
      ai_models_used: ["claude", "gemini", "gpt"],
      status,
      result_pnl_percent: pnl ? Math.round(pnl * 100) / 100 : null,
      closed_at: status !== "active" ? new Date(createdAt.getTime() + Math.random() * 4 * 60 * 60 * 1000).toISOString() : null,
      min_tier_required: sym.cat === "coin_spot" ? "basic" : sym.cat === "coin_futures" ? "pro" : "premium",
      created_at: createdAt.toISOString(),
    });
  }

  const { error: signalError } = await supabase.from("signals").insert(signals);
  if (signalError) {
    console.error("Error inserting signals:", signalError.message);
  } else {
    console.log(`  ✅ Created ${signals.length} test signals`);
  }

  // 2. Create backtest results
  console.log("📈 Creating backtest results...");
  const backtestData = signalCategories.map((cat) => {
    const catSignals = signals.filter((s) => s.category === cat && s.status !== "active");
    const wins = catSignals.filter((s) => s.result_pnl_percent && Number(s.result_pnl_percent) > 0);
    const totalPnl = catSignals.reduce((sum, s) => sum + (Number(s.result_pnl_percent) || 0), 0);

    return {
      category: cat,
      period_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      period_end: new Date().toISOString().split("T")[0],
      total_signals: catSignals.length,
      winning_signals: wins.length,
      win_rate: catSignals.length > 0 ? Math.round((wins.length / catSignals.length) * 10000) / 100 : 0,
      avg_profit_percent: wins.length > 0 ? Math.round((wins.reduce((s, w) => s + (Number(w.result_pnl_percent) || 0), 0) / wins.length) * 100) / 100 : 0,
      avg_loss_percent: Math.round(-2.1 * 100) / 100,
      max_drawdown_percent: Math.round(Math.random() * 15 * 100) / 100,
      sharpe_ratio: Math.round((1 + Math.random()) * 100) / 100,
      profit_factor: Math.round((1.5 + Math.random()) * 100) / 100,
      total_pnl_percent: Math.round(totalPnl * 100) / 100,
      monthly_breakdown: [
        { month: "2025-12", signals: 15, winRate: 66.7, pnl: 12.3 },
        { month: "2026-01", signals: 18, winRate: 72.2, pnl: 23.5 },
        { month: "2026-02", signals: 10, winRate: 60.0, pnl: 8.7 },
      ],
      generated_at: new Date().toISOString(),
    };
  });

  const { error: btError } = await supabase.from("backtest_results").insert(backtestData);
  if (btError) {
    console.error("Error inserting backtest:", btError.message);
  } else {
    console.log(`  ✅ Created ${backtestData.length} backtest results`);
  }

  console.log("\n🎉 Seeding complete!");
  console.log("\nNote: Partner, product, and subscription seed data requires");
  console.log("actual user accounts. Create users first, then run partner seeding.");
}

seed().catch(console.error);

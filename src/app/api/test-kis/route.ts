import { NextResponse } from "next/server";
import {
  getAccessToken,
  getStockPrice,
  getStockDailyChart,
  getMultipleStockPrices,
  formatStockDataForAI,
} from "@/lib/kis";

export async function GET() {
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Step 1: Test OAuth token
  try {
    console.log("[KIS Test] Getting access token...");
    const token = await getAccessToken();
    results.token = {
      success: true,
      tokenPreview: token.substring(0, 20) + "...",
    };
    console.log("[KIS Test] Token obtained successfully");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    errors.push(`Token: ${msg}`);
    results.token = { success: false, error: msg };
    // Can't proceed without token
    return NextResponse.json({
      success: false,
      message: "Failed to get access token",
      results,
      errors,
    });
  }

  // Step 2: Test single stock price (삼성전자)
  try {
    console.log("[KIS Test] Fetching Samsung Electronics price...");
    const samsungPrice = await getStockPrice("005930");
    results.singleStock = {
      success: true,
      data: samsungPrice,
    };
    console.log(
      `[KIS Test] Samsung price: ${samsungPrice?.currentPrice?.toLocaleString()}원`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    errors.push(`Single stock: ${msg}`);
    results.singleStock = { success: false, error: msg };
  }

  // Step 3: Test multiple stock prices (top 5)
  try {
    console.log("[KIS Test] Fetching top 5 stock prices...");
    const top5 = await getMultipleStockPrices([
      "005930", // 삼성전자
      "000660", // SK하이닉스
      "035420", // NAVER
      "035720", // 카카오
      "005380", // 현대차
    ]);
    results.multipleStocks = {
      success: true,
      count: top5.length,
      data: top5.map((s) => ({
        name: s.name,
        code: s.code,
        price: s.currentPrice,
        change: `${s.changeRate >= 0 ? "+" : ""}${s.changeRate}%`,
        volume: s.volume,
        per: s.per,
        pbr: s.pbr,
      })),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    errors.push(`Multiple stocks: ${msg}`);
    results.multipleStocks = { success: false, error: msg };
  }

  // Step 4: Test daily chart data (삼성전자 30일)
  try {
    console.log("[KIS Test] Fetching Samsung 30-day chart...");
    const dailyChart = await getStockDailyChart("005930", "D", 30);
    results.dailyChart = {
      success: true,
      count: dailyChart.length,
      sample: dailyChart.slice(-5),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    errors.push(`Daily chart: ${msg}`);
    results.dailyChart = { success: false, error: msg };
  }

  // Step 5: Test AI formatting
  try {
    const price = await getStockPrice("005930");
    const daily = await getStockDailyChart("005930", "D", 30);
    if (price && daily.length > 0) {
      const formatted = formatStockDataForAI(price, daily);
      results.aiFormat = {
        success: true,
        preview: formatted.substring(0, 500) + "...",
      };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    errors.push(`AI format: ${msg}`);
  }

  return NextResponse.json({
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

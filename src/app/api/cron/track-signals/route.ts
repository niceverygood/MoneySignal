import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getMultipleSpotPrices } from "@/lib/binance";
import { sendTelegramMessage, formatTPHitMessage, formatSLHitMessage } from "@/lib/telegram";
import type { Signal } from "@/types";

const TIER_ORDER: Record<string, number> = { free: 0, basic: 1, pro: 2, premium: 3, bundle: 4 };

async function sendTPSLAlerts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  signal: Signal,
  newStatus: string,
  pnl: number
): Promise<void> {
  try {
    const { data: telegramUsers } = await supabase
      .from("telegram_connections")
      .select("telegram_chat_id, user_id, notification_settings, profiles!inner(subscription_tier, subscription_expires_at)")
      .eq("is_active", true);

    if (!telegramUsers) return;

    const isTP = newStatus.startsWith("hit_tp");
    const tpLevel = isTP ? parseInt(newStatus.replace("hit_tp", "")) : 0;
    const isSL = newStatus === "hit_sl";

    // TP 단계별 최소 티어: TP1=basic, TP2=pro, TP3=premium
    const tpMinTierOrder = isTP ? (tpLevel === 1 ? 1 : tpLevel === 2 ? 2 : 3) : 2;

    let message = "";
    if (isTP) {
      message = formatTPHitMessage(signal, tpLevel, pnl);
    } else if (isSL) {
      message = formatSLHitMessage(signal, pnl);
    } else {
      return;
    }

    for (const u of telegramUsers) {
      const tier = u.profiles?.subscription_tier || "free";
      const expires = u.profiles?.subscription_expires_at;
      const isExpired = expires && new Date(expires) < new Date();
      const settings = u.notification_settings || {};

      const checkKey = isTP ? "tp_hit" : "sl_hit";
      if (
        TIER_ORDER[tier] >= tpMinTierOrder &&
        !isExpired &&
        settings[checkKey] !== false
      ) {
        await sendTelegramMessage(u.telegram_chat_id, message).catch(() => null);
      }
    }
  } catch (err) {
    console.error("[Track Signals] Alert error:", err);
  }
}

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

  // Fetch all active signals
  const { data: activeSignals, error: fetchError } = await supabase
    .from("signals")
    .select("*")
    .eq("status", "active");

  if (fetchError || !activeSignals) {
    return NextResponse.json(
      { error: fetchError?.message || "No active signals" },
      { status: 500 }
    );
  }

  if (activeSignals.length === 0) {
    return NextResponse.json({ message: "No active signals to track" });
  }

  // Get unique crypto symbols for price fetch
  const cryptoSymbols = [
    ...new Set(
      activeSignals
        .filter(
          (s) =>
            s.category === "coin_spot" || s.category === "coin_futures"
        )
        .map((s) => s.symbol)
    ),
  ];

  // Fetch current prices from Binance
  let prices: Record<string, number> = {};
  if (cryptoSymbols.length > 0) {
    try {
      prices = await getMultipleSpotPrices(cryptoSymbols);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
    }
  }

  const trackingRecords: Array<{
    signal_id: string;
    current_price: number;
    pnl_percent: number;
    status_at_check: string;
  }> = [];

  const signalUpdates: Array<{
    id: string;
    status: string;
    result_pnl_percent: number;
    closed_at: string;
  }> = [];

  for (const signal of activeSignals) {
    let currentPrice: number | null = null;

    // Get current price based on category
    if (
      signal.category === "coin_spot" ||
      signal.category === "coin_futures"
    ) {
      currentPrice = prices[signal.symbol] || null;
    }
    // For overseas_futures and kr_stock, we skip price tracking
    // (would need separate API integrations)

    if (!currentPrice) {
      // Check if signal expired
      if (new Date(signal.valid_until) < new Date()) {
        signalUpdates.push({
          id: signal.id,
          status: "expired",
          result_pnl_percent: 0,
          closed_at: new Date().toISOString(),
        });
      }
      continue;
    }

    const entryPrice = Number(signal.entry_price);
    const isLong =
      signal.direction === "long" || signal.direction === "buy";
    const pnlPercent = isLong
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;

    // Determine status
    let newStatus = "active";
    const tp1 = signal.take_profit_1 ? Number(signal.take_profit_1) : null;
    const tp2 = signal.take_profit_2 ? Number(signal.take_profit_2) : null;
    const tp3 = signal.take_profit_3 ? Number(signal.take_profit_3) : null;
    const sl = signal.stop_loss ? Number(signal.stop_loss) : null;

    if (isLong) {
      if (tp3 && currentPrice >= tp3) newStatus = "hit_tp3";
      else if (tp2 && currentPrice >= tp2) newStatus = "hit_tp2";
      else if (tp1 && currentPrice >= tp1) newStatus = "hit_tp1";
      else if (sl && currentPrice <= sl) newStatus = "hit_sl";
    } else {
      if (tp3 && currentPrice <= tp3) newStatus = "hit_tp3";
      else if (tp2 && currentPrice <= tp2) newStatus = "hit_tp2";
      else if (tp1 && currentPrice <= tp1) newStatus = "hit_tp1";
      else if (sl && currentPrice >= sl) newStatus = "hit_sl";
    }

    // Check expiry
    if (
      newStatus === "active" &&
      new Date(signal.valid_until) < new Date()
    ) {
      newStatus = "expired";
    }

    // Add tracking record
    trackingRecords.push({
      signal_id: signal.id,
      current_price: currentPrice,
      pnl_percent: Math.round(pnlPercent * 100) / 100,
      status_at_check: newStatus,
    });

    // If status changed, update signal
    if (newStatus !== "active") {
      signalUpdates.push({
        id: signal.id,
        status: newStatus,
        result_pnl_percent: Math.round(pnlPercent * 100) / 100,
        closed_at: new Date().toISOString(),
      });
    }
  }

  // Bulk insert tracking records
  if (trackingRecords.length > 0) {
    const { error: trackError } = await supabase
      .from("signal_tracking")
      .insert(trackingRecords);

    if (trackError) {
      console.error("Error inserting tracking records:", trackError);
    }
  }

  // Update signals that hit TP/SL/expired
  for (const update of signalUpdates) {
    const { error: updateError } = await supabase
      .from("signals")
      .update({
        status: update.status,
        result_pnl_percent: update.result_pnl_percent,
        closed_at: update.closed_at,
      })
      .eq("id", update.id);

    if (updateError) {
      console.error(`Error updating signal ${update.id}:`, updateError);
      continue;
    }

    // TP/SL 도달 시 텔레그램 알림 발송
    if (update.status !== "expired" && process.env.TELEGRAM_BOT_TOKEN) {
      const signal = activeSignals.find((s) => s.id === update.id);
      if (signal) {
        await sendTPSLAlerts(supabase, signal as Signal, update.status, update.result_pnl_percent);
      }
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    tracked: trackingRecords.length,
    updated: signalUpdates.length,
    updates: signalUpdates.map((u) => ({
      id: u.id,
      status: u.status,
      pnl: u.result_pnl_percent,
    })),
  });
}

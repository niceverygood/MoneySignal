import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  TIER_CONFIG,
  isSignalVisibleForTier,
  filterSignalByTier,
  checkDailyLimit,
} from "@/lib/tier-access";
import type { TierKey } from "@/lib/tier-access";
import type { Signal } from "@/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  // Get user's subscription tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const userTier = (profile?.subscription_tier || "free") as TierKey;
  const tierConfig = TIER_CONFIG[userTier];

  // Check daily limit (count today's views)
  let viewedToday = 0;
  if (tierConfig.dailyLimit !== Infinity) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count, error: viewError } = await supabase
      .from("signal_views")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("viewed_at", todayStart.toISOString());
    // If table doesn't exist, ignore the error
    if (!viewError) {
      viewedToday = count || 0;
    }
  }

  const dailyLimitReached = !checkDailyLimit(viewedToday, userTier);

  // Build query with tier-based filters
  let query = supabase
    .from("signals")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Category filter (user-selected + tier restriction)
  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  // Apply delay filter at DB level for efficiency
  if (tierConfig.delayMinutes > 0 && tierConfig.delayMinutes !== Infinity) {
    const cutoffTime = new Date(Date.now() - tierConfig.delayMinutes * 60 * 1000);
    // Show signals created before the cutoff OR completed signals
    query = query.or(`created_at.lte.${cutoffTime.toISOString()},status.neq.active`);
  } else if (tierConfig.delayMinutes < 0) {
    // Bundle: can see future-scheduled signals (pre-release)
    // No time filter needed
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Apply tier-based filtering to each signal
  const filteredSignals = (data as Signal[])
    .filter((signal) => {
      const visibility = isSignalVisibleForTier(signal, userTier);
      // Always include completed signals (for result transparency)
      if (signal.status !== "active") return true;
      return visibility.visible;
    })
    .map((signal) => {
      if (dailyLimitReached && signal.status === "active") {
        // Over daily limit: blur active signals
        return filterSignalByTier(signal, "free");
      }
      return filterSignalByTier(signal, userTier);
    });

  return NextResponse.json({
    signals: filteredSignals,
    userTier,
    dailyLimit: tierConfig.dailyLimit === Infinity ? null : tierConfig.dailyLimit,
    viewedToday,
    dailyLimitReached,
    total: filteredSignals.length,
  });
}

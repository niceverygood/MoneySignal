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
  const rawLimit = parseInt(searchParams.get("limit") || "50") || 50;
  const rawOffset = parseInt(searchParams.get("offset") || "0") || 0;

  if (rawLimit < 1 || rawLimit > 200) {
    return NextResponse.json({ error: "limit은 1~200 사이여야 합니다" }, { status: 400 });
  }
  if (rawOffset < 0) {
    return NextResponse.json({ error: "offset은 0 이상이어야 합니다" }, { status: 400 });
  }

  const limit = rawLimit;
  const offset = rawOffset;

  // Get user's subscription tier + daily view count in parallel
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [profileResult, viewCountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single(),
    supabase
      .from("signal_views")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("viewed_at", todayStart.toISOString()),
  ]);

  const userTier = (profileResult.data?.subscription_tier || "free") as TierKey;
  const tierConfig = TIER_CONFIG[userTier];

  let viewedToday = 0;
  if (tierConfig.dailyLimit !== Infinity && !viewCountResult.error) {
    viewedToday = viewCountResult.count || 0;
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
    console.error("[Signals] DB error:", error);
    return NextResponse.json({ error: "시그널 조회 중 오류가 발생했습니다" }, { status: 500 });
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

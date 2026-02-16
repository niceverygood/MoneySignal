import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TierKey } from "@/lib/tier-access";

const TIER_ORDER: TierKey[] = ["free", "basic", "pro", "premium", "bundle"];

function tierIndex(tier: TierKey): number {
  return TIER_ORDER.indexOf(tier);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "weekly";
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  // Get user's subscription tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const userTier = (profile?.subscription_tier || "free") as TierKey;
  const userTierIdx = tierIndex(userTier);

  // Query market reports by type
  const { data: reports, error } = await supabase
    .from("market_reports")
    .select("*")
    .eq("type", type)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add isLocked flag based on tier comparison
  const reportsWithAccess = (reports || []).map((report) => {
    const requiredTier = (report.min_tier_required || "pro") as TierKey;
    const requiredIdx = tierIndex(requiredTier);
    const isLocked = userTierIdx < requiredIdx;

    return {
      id: report.id,
      type: report.type,
      title: report.title,
      summary: report.summary,
      content: isLocked ? null : report.content,
      performance_data: isLocked ? null : report.performance_data,
      min_tier_required: report.min_tier_required,
      week_start: report.week_start,
      created_at: report.created_at,
      isLocked,
    };
  });

  return NextResponse.json({
    reports: reportsWithAccess,
    userTier,
    total: reportsWithAccess.length,
  });
}

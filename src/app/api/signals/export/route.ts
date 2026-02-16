import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TierKey } from "@/lib/tier-access";
import { TIER_CONFIG } from "@/lib/tier-access";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's subscription tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const userTier = (profile?.subscription_tier || "free") as TierKey;
  const tierConfig = TIER_CONFIG[userTier];

  // CSV export is premium/bundle only
  if (!tierConfig.csvExport) {
    return NextResponse.json(
      { error: "CSV 내보내기는 Premium 이상 구독자만 이용할 수 있습니다." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from과 to 날짜 파라미터가 필요합니다. (예: ?from=2026-01-01&to=2026-02-16)" },
      { status: 400 }
    );
  }

  // Query signals in date range
  const { data: signals, error } = await supabase
    .from("signals")
    .select("*")
    .gte("created_at", `${from}T00:00:00Z`)
    .lte("created_at", `${to}T23:59:59Z`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!signals || signals.length === 0) {
    return NextResponse.json({ error: "해당 기간에 시그널이 없습니다." }, { status: 404 });
  }

  // Generate CSV
  const headers = [
    "ID",
    "카테고리",
    "종목코드",
    "종목명",
    "방향",
    "진입가",
    "손절가",
    "1차익절",
    "2차익절",
    "3차익절",
    "보수적레버리지",
    "공격적레버리지",
    "신뢰도",
    "타임프레임",
    "상태",
    "수익률(%)",
    "생성일",
    "종료일",
  ];

  const rows = signals.map((s) => [
    s.id,
    s.category,
    s.symbol,
    s.symbol_name,
    s.direction,
    s.entry_price,
    s.stop_loss ?? "",
    s.take_profit_1 ?? "",
    s.take_profit_2 ?? "",
    s.take_profit_3 ?? "",
    s.leverage_conservative ?? "",
    s.leverage_aggressive ?? "",
    s.confidence,
    s.timeframe,
    s.status,
    s.result_pnl_percent ?? "",
    s.created_at,
    s.closed_at ?? "",
  ]);

  // BOM for Excel Korean support
  const BOM = "\uFEFF";
  const csvContent = BOM + [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ].join("\n");

  const filename = `moneysignal_${from}_${to}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
  // Admin 권한 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 접근 가능합니다" }, { status: 403 });
  }

  const { action } = await request.json();
  const validActions = ["generate-signals", "calculate-backtest", "track-signals", "weekly-report", "daily-briefing", "subscription-check", "auto-billing", "monthly-settlement"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "유효하지 않은 작업입니다" }, { status: 400 });
  }

  // 서버사이드에서 Cron API 호출 (secret 포함)
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(request.url).origin
    : "http://localhost:3000";

  const cronSecret = process.env.CRON_SECRET || "dev";
  const res = await fetch(`${baseUrl}/api/cron/${action}?secret=${cronSecret}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${cronSecret}` },
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    return NextResponse.json({ success: true, data });
  } else {
    return NextResponse.json({ error: "작업 실행에 실패했습니다" }, { status: res.status });
  }
  } catch (outerError) {
    console.error("[admin/trigger-cron] Outer error:", outerError);
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

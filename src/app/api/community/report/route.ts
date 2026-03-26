import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetType, targetId, targetUserId, reason } = await request.json();

  if (!targetType || !targetId || !targetUserId || !reason) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // 신고 등록
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    target_user_id: targetUserId,
    reason,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }

  // 관리자에게 알림
  const serviceSupabase = await createServiceClient();
  const { data: admins } = await serviceSupabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins) {
    const typeLabel = targetType === "post" ? "게시글" : "댓글";
    const notifications = admins.map((admin: { id: string }) => ({
      user_id: admin.id,
      type: "system",
      title: `${typeLabel} 신고 접수`,
      body: `사유: ${reason}. 24시간 내 검토가 필요합니다.`,
      data: { report_target_type: targetType, report_target_id: targetId, reporter_id: user.id },
      is_read: false,
    }));

    await serviceSupabase.from("notifications").insert(notifications).then(null, () => null);
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockedId } = await request.json();
  if (!blockedId) return NextResponse.json({ error: "Missing blockedId" }, { status: 400 });
  if (blockedId === user.id) return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });

  // 차단 등록
  const { error } = await supabase.from("community_blocks").upsert(
    { blocker_id: user.id, blocked_id: blockedId },
    { onConflict: "blocker_id,blocked_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Failed to block user" }, { status: 500 });
  }

  // 관리자에게 알림 (notifications 테이블에 기록)
  const serviceSupabase = await createServiceClient();
  const { data: admins } = await serviceSupabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins) {
    const { data: blockedProfile } = await serviceSupabase
      .from("profiles")
      .select("display_name")
      .eq("id", blockedId)
      .single();

    const notifications = admins.map((admin: { id: string }) => ({
      user_id: admin.id,
      type: "system",
      title: "유저 차단 알림",
      body: `${blockedProfile?.display_name || "유저"}(이)가 차단되었습니다. 해당 유저의 콘텐츠를 검토해주세요.`,
      data: { blocked_user_id: blockedId, blocker_user_id: user.id },
      is_read: false,
    }));

    await serviceSupabase.from("notifications").insert(notifications).then(null, () => null);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockedId } = await request.json();

  const { error } = await supabase
    .from("community_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId);

  if (error) {
    return NextResponse.json({ error: "Failed to unblock" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 관리자 계정 삭제 방지
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin") {
      return NextResponse.json({ error: "관리자 계정은 탈퇴할 수 없습니다." }, { status: 403 });
    }

    // 활성 구독 확인 → 해지 처리
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled", auto_renew: false })
      .eq("user_id", user.id)
      .eq("status", "active");

    // profiles 삭제 (CASCADE로 관련 데이터 정리)
    await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);

    // Supabase Auth에서 유저 삭제
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabaseAdmin.auth.admin.deleteUser(user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-account] Error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

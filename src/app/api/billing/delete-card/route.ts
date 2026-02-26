import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // 1. 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 빌링키 비활성화
  const { data: billingKey } = await serviceClient
    .from("billing_keys")
    .select("id, is_active")
    .eq("user_id", user.id)
    .single();

  if (!billingKey) {
    return NextResponse.json({ error: "등록된 카드가 없습니다" }, { status: 404 });
  }

  if (!billingKey.is_active) {
    return NextResponse.json({ error: "이미 삭제된 카드입니다" }, { status: 400 });
  }

  try {
    await serviceClient
      .from("billing_keys")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", billingKey.id);

    // 3. 활성 구독의 auto_renew 해제
    await serviceClient
      .from("subscriptions")
      .update({ auto_renew: false, next_billing_at: null })
      .eq("user_id", user.id)
      .eq("status", "active");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[billing/delete-card] Error:", error);
    return NextResponse.json(
      { error: "카드 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
  } catch (outerError) {
    console.error("[billing/delete-card] Outer error:", outerError);
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

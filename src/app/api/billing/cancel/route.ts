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

  // 2. 활성 구독 조회
  const { data: subscription } = await serviceClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!subscription) {
    return NextResponse.json(
      { error: "활성 구독이 없습니다" },
      { status: 404 }
    );
  }

  if (!subscription.auto_renew) {
    return NextResponse.json(
      { error: "이미 해지 예약된 구독입니다" },
      { status: 400 }
    );
  }

  try {
    // 3. auto_renew 해제 (현재 기간 끝까지 서비스 유지)
    await serviceClient
      .from("subscriptions")
      .update({
        auto_renew: false,
        next_billing_at: null,
      })
      .eq("id", subscription.id);

    // 4. 빌링키 비활성화
    if (subscription.billing_key_id) {
      await serviceClient
        .from("billing_keys")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", subscription.billing_key_id);
    }

    // 5. 알림
    await serviceClient.from("notifications").insert({
      user_id: user.id,
      type: "subscription",
      title: "구독 해지 예약",
      body: `${new Date(subscription.current_period_end).toLocaleDateString("ko-KR")}까지 서비스 이용 후 자동 해지됩니다.`,
    });

    return NextResponse.json({
      success: true,
      expiresAt: subscription.current_period_end,
    });
  } catch (error) {
    console.error("[billing/cancel] Error:", error);
    return NextResponse.json(
      { error: "해지 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
  } catch (outerError) {
    console.error("[billing/cancel] Outer error:", outerError);
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

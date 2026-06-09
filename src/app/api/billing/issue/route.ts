import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  chargeBillingKey,
  generateOrderId,
  PLAN_PRICES,
  calculatePeriodEnd,
} from "@/lib/portone";

export async function POST(request: NextRequest) {
  try {
  const supabase = await createClient();

  // 1. 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  // 2. 입력 검증
  const { billingKey, tier, billingCycle, cardName, cardNumberMasked } =
    await request.json();

  if (!billingKey || !tier) {
    return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
  }

  const cycle = billingCycle || "monthly";
  const prices = PLAN_PRICES[tier];
  if (!prices || !prices[cycle]) {
    return NextResponse.json({ error: "유효하지 않은 플랜" }, { status: 400 });
  }

  const amount = prices[cycle];
  if (amount > 5000000) {
    return NextResponse.json({ error: "결제 금액이 허용 범위를 초과합니다" }, { status: 400 });
  }

  // 3. 즉시 1회 결제 실행
  const paymentId = generateOrderId();
  const tierNames: Record<string, string> = {
    basic: "Basic",
    pro: "Pro",
    premium: "Premium",
    bundle: "VIP Bundle",
  };
  const cycleLabels: Record<string, string> = {
    monthly: "월간",
    quarterly: "분기",
    yearly: "연간",
  };
  const orderName = `머니시그널 ${tierNames[tier] || tier} ${cycleLabels[cycle] || cycle} 구독`;

  const chargeResult = await chargeBillingKey({
    billingKey,
    paymentId,
    orderName,
    amount,
  });

  if (!chargeResult.success) {
    return NextResponse.json(
      { error: chargeResult.failureReason || "결제 실패" },
      { status: 400 }
    );
  }

  try {
    const now = new Date();
    const periodEnd = calculatePeriodEnd(cycle, now);

    // 5. billing_keys upsert + id 직접 받기
    const { data: bkRow } = await serviceClient.from("billing_keys").upsert(
      {
        user_id: user.id,
        billing_key: billingKey,
        card_name: cardName || null,
        card_number_masked: cardNumberMasked || null,
        is_active: true,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    ).select("id").single();

    const billingKeyId = bkRow?.id || null;

    // 6. transactions 기록
    await serviceClient.from("transactions").insert({
      type: "subscription_payment",
      user_id: user.id,
      amount,
      currency: "KRW",
      status: "completed",
      payment_method: "billing_key",
      pg_transaction_id: chargeResult.pgTransactionId || paymentId,
      description: `${tier.toUpperCase()} ${cycleLabels[cycle] || cycle} 구독 (빌링키)`,
    });

    // 7. subscriptions upsert (기존 active 있으면 update)
    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    const subscriptionData = {
      user_id: user.id,
      status: "active" as const,
      billing_cycle: cycle,
      amount_paid: amount,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      auto_renew: true,
      tier,
      billing_key_id: billingKeyId,
      next_billing_at: periodEnd.toISOString(),
      last_billing_at: now.toISOString(),
      billing_retry_count: 0,
      billing_failed_at: null as string | null,
    };

    if (existingSub) {
      await serviceClient
        .from("subscriptions")
        .update(subscriptionData)
        .eq("id", existingSub.id);
    } else {
      await serviceClient.from("subscriptions").insert(subscriptionData);
    }

    // 8. profiles 업데이트
    await serviceClient
      .from("profiles")
      .update({
        subscription_tier: tier,
        subscription_expires_at: periodEnd.toISOString(),
      })
      .eq("id", user.id);

    // 9. 사용자 알림
    await serviceClient.from("notifications").insert({
      user_id: user.id,
      type: "subscription",
      title: "구독 시작!",
      body: `${tier.toUpperCase()} 구독이 시작되었습니다. ${periodEnd.toLocaleDateString("ko-KR")}까지 이용 가능합니다.`,
    });

    return NextResponse.json({
      success: true,
      tier,
      amount,
      billingCycle: cycle,
      expiresAt: periodEnd.toISOString(),
      nextBillingAt: periodEnd.toISOString(),
    });
  } catch (error) {
    console.error("[billing/issue] Error:", error);
    return NextResponse.json(
      { error: "결제 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
  } catch (outerError) {
    console.error("[billing/issue] Outer error:", outerError);
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

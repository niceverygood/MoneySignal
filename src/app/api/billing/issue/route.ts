import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  chargeBillingKey,
  generateOrderId,
  PLAN_PRICES,
  calculatePeriodEnd,
} from "@/lib/portone";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // 1. 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 입력 검증
  const { billingKey, tier, billingCycle, referralCode, cardName, cardNumberMasked } =
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

  // 4. 파트너 수익 분배
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("referred_by, email, display_name")
    .eq("id", user.id)
    .single();

  let partnerId: string | null = null;
  let partnerUserId: string | null = null;
  let partnerShare = 0;
  let platformShare = amount;
  const partnerRef = referralCode || profile?.referred_by;

  if (partnerRef) {
    let partnerQuery = serviceClient
      .from("partners")
      .select("id, user_id, revenue_share_rate, is_active")
      .eq("is_active", true);

    if (referralCode) {
      partnerQuery = partnerQuery.eq("referral_code", referralCode.toUpperCase());
    } else {
      partnerQuery = partnerQuery.eq("user_id", partnerRef);
    }

    const { data: partner } = await partnerQuery.single();
    if (partner) {
      partnerId = partner.id;
      partnerUserId = partner.user_id;
      partnerShare = Math.round(amount * partner.revenue_share_rate);
      platformShare = amount - partnerShare;
    }
  }

  try {
    const now = new Date();
    const periodEnd = calculatePeriodEnd(cycle, now);

    // 5. billing_keys upsert
    await serviceClient.from("billing_keys").upsert(
      {
        user_id: user.id,
        billing_key: billingKey,
        card_name: cardName || null,
        card_number_masked: cardNumberMasked || null,
        is_active: true,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    );

    // billing_key id 조회
    const { data: bkRow } = await serviceClient
      .from("billing_keys")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const billingKeyId = bkRow?.id || null;

    // 6. transactions 기록
    await serviceClient.from("transactions").insert({
      type: "subscription_payment",
      user_id: user.id,
      partner_id: partnerId,
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
      product_id: null as string | null,
      partner_id: partnerId,
      status: "active" as const,
      billing_cycle: cycle,
      amount_paid: amount,
      partner_share: partnerShare,
      platform_share: platformShare,
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

    // 파트너 상품 연결
    if (partnerId) {
      const { data: product } = await serviceClient
        .from("products")
        .select("id")
        .eq("partner_id", partnerId)
        .limit(1)
        .single();
      if (product) {
        subscriptionData.product_id = product.id;
      }
    }

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
        referred_by: partnerUserId || profile?.referred_by,
      })
      .eq("id", user.id);

    // 9. 파트너 수익 업데이트
    if (partnerId) {
      const { data: partnerData } = await serviceClient
        .from("partners")
        .select("total_revenue, available_balance, subscriber_count")
        .eq("id", partnerId)
        .single();

      if (partnerData) {
        await serviceClient
          .from("partners")
          .update({
            total_revenue: Number(partnerData.total_revenue) + amount,
            available_balance: Number(partnerData.available_balance) + partnerShare,
            subscriber_count: partnerData.subscriber_count + 1,
          })
          .eq("id", partnerId);
      }

      // 파트너 알림
      if (partnerUserId) {
        await serviceClient.from("notifications").insert({
          user_id: partnerUserId,
          type: "subscription",
          title: "새 구독자 등록",
          body: `${profile?.display_name || profile?.email || "사용자"}님이 ${tier.toUpperCase()} 구독을 시작했습니다. (수익: ${partnerShare.toLocaleString()}원)`,
        });
      }
    }

    // 10. 사용자 알림
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
      partnerShare,
      platformShare,
    });
  } catch (error) {
    console.error("[billing/issue] Error:", error);
    return NextResponse.json(
      { error: "결제 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

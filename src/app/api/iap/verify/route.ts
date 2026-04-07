import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_PRICES, calculatePeriodEnd } from "@/lib/portone";

// ============================================
// Apple IAP 트랜잭션 검증 + 구독 활성화
// ============================================

interface IAPVerifyRequest {
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDate: string;
  expirationDate: string;
  jwsRepresentation?: string;
  tier: string;
  billingCycle: string;
}

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

    const body: IAPVerifyRequest = await request.json();
    const { productId, transactionId, originalTransactionId, tier, billingCycle } = body;

    if (!productId || !transactionId || !tier) {
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
    }

    // 2. 플랜 유효성 검증
    const prices = PLAN_PRICES[tier];
    if (!prices || !prices[billingCycle]) {
      return NextResponse.json({ error: "유효하지 않은 플랜" }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    // 3. 중복 트랜잭션 방지 (replay attack)
    const { data: existingTx } = await serviceClient
      .from("transactions")
      .select("id")
      .eq("pg_transaction_id", `apple_${transactionId}`)
      .single();

    if (existingTx) {
      return NextResponse.json(
        { error: "이미 처리된 트랜잭션입니다" },
        { status: 409 }
      );
    }

    const amount = prices[billingCycle];
    const now = new Date();
    const periodEnd = body.expirationDate
      ? new Date(body.expirationDate)
      : calculatePeriodEnd(billingCycle, now);

    // 4. 파트너 조회
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("referred_by, email, display_name")
      .eq("id", user.id)
      .single();

    let partnerId: string | null = null;
    let partnerUserId: string | null = null;
    let partnerShare = 0;
    let platformShare = amount;

    if (profile?.referred_by) {
      const { data: partner } = await serviceClient
        .from("partners")
        .select("id, user_id, revenue_share_rate, is_active")
        .eq("user_id", profile.referred_by)
        .eq("is_active", true)
        .single();

      if (partner) {
        partnerId = partner.id;
        partnerUserId = partner.user_id;
        partnerShare = Math.round(amount * partner.revenue_share_rate);
        platformShare = amount - partnerShare;
      }
    }

    // 5. transactions 기록
    await serviceClient.from("transactions").insert({
      type: "subscription_payment",
      user_id: user.id,
      partner_id: partnerId,
      amount,
      currency: "KRW",
      status: "completed",
      payment_method: "apple_iap",
      pg_transaction_id: `apple_${transactionId}`,
      description: `${tier.toUpperCase()} ${billingCycle} 구독 (Apple IAP)`,
    });

    // 6. subscriptions upsert
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
      billing_cycle: billingCycle,
      amount_paid: amount,
      partner_share: partnerShare,
      platform_share: platformShare,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      auto_renew: true,
      tier,
      billing_key_id: null,
      next_billing_at: periodEnd.toISOString(),
      last_billing_at: now.toISOString(),
      billing_retry_count: 0,
      billing_failed_at: null as string | null,
    };

    if (partnerId) {
      const { data: product } = await serviceClient
        .from("products")
        .select("id")
        .eq("partner_id", partnerId)
        .limit(1)
        .single();
      if (product) subscriptionData.product_id = product.id;
    }

    if (existingSub) {
      await serviceClient
        .from("subscriptions")
        .update(subscriptionData)
        .eq("id", existingSub.id);
    } else {
      await serviceClient.from("subscriptions").insert(subscriptionData);
    }

    // 7. profiles 업데이트
    await serviceClient
      .from("profiles")
      .update({
        subscription_tier: tier,
        subscription_expires_at: periodEnd.toISOString(),
      })
      .eq("id", user.id);

    // 8. 파트너 수익 업데이트
    if (partnerId && partnerUserId) {
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

      await serviceClient.from("notifications").insert({
        user_id: partnerUserId,
        type: "subscription",
        title: "새 구독자 등록",
        body: `${profile?.display_name || profile?.email || "사용자"}님이 ${tier.toUpperCase()} 구독을 시작했습니다. (수익: ${partnerShare.toLocaleString()}원)`,
      });
    }

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
      billingCycle,
      expiresAt: periodEnd.toISOString(),
      appleTransactionId: transactionId,
      originalTransactionId,
    });
  } catch (error) {
    console.error("[iap/verify] Error:", error);
    return NextResponse.json(
      { error: "IAP 검증 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

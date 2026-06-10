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

    // 4. transactions 기록 (pg_transaction_id UNIQUE 제약 — 동시 요청/재전송 중복결제 방지)
    const { error: txError } = await serviceClient.from("transactions").insert({
      type: "subscription_payment",
      user_id: user.id,
      amount,
      currency: "KRW",
      status: "completed",
      payment_method: "apple_iap",
      pg_transaction_id: `apple_${transactionId}`,
      description: `${tier.toUpperCase()} ${billingCycle} 구독 (Apple IAP)`,
    });
    if (txError) {
      // UNIQUE 위반(23505) = 이미 처리된 트랜잭션 (replay 체크와 insert 사이 race 포함) → 멱등 처리
      if (txError.code === "23505") {
        return NextResponse.json({ error: "이미 처리된 트랜잭션입니다" }, { status: 409 });
      }
      throw txError;
    }

    // 5. subscriptions upsert
    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    const subscriptionData = {
      user_id: user.id,
      status: "active" as const,
      billing_cycle: billingCycle,
      amount_paid: amount,
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

    if (existingSub) {
      await serviceClient
        .from("subscriptions")
        .update(subscriptionData)
        .eq("id", existingSub.id);
    } else {
      await serviceClient.from("subscriptions").insert(subscriptionData);
    }

    // 6. profiles 업데이트
    await serviceClient
      .from("profiles")
      .update({
        subscription_tier: tier,
        subscription_expires_at: periodEnd.toISOString(),
      })
      .eq("id", user.id);

    // 7. 사용자 알림
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

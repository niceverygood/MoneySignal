import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    paymentId,
    orderId,
    tier,
    amount,
    billingCycle,
    referralCode,
  } = await request.json();

  if (!paymentId || !orderId || !tier || !amount) {
    return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
  }

  // 1. PortOne API로 결제 검증
  const apiSecret = process.env.PORTONE_API_SECRET;
  let verified = false;
  let pgTransactionId = paymentId;

  if (apiSecret) {
    try {
      const verifyRes = await fetch(
        `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
        {
          headers: {
            Authorization: `PortOne ${apiSecret}`,
          },
        }
      );

      if (verifyRes.ok) {
        const paymentData = await verifyRes.json();

        // 금액 검증
        if (paymentData.amount?.total === amount && paymentData.status === "PAID") {
          verified = true;
          pgTransactionId = paymentData.pgTxId || paymentId;
        } else {
          console.error("Payment verification failed:", {
            expected: amount,
            actual: paymentData.amount?.total,
            status: paymentData.status,
          });
          return NextResponse.json(
            { error: "결제 금액이 일치하지 않습니다" },
            { status: 400 }
          );
        }
      } else {
        const errText = await verifyRes.text();
        console.error("PortOne verify error:", errText);
        // Fallback: 개발 환경에서는 검증 없이 통과
        if (process.env.NODE_ENV !== "production") {
          verified = true;
        }
      }
    } catch (err) {
      console.error("Payment verification error:", err);
      if (process.env.NODE_ENV !== "production") {
        verified = true;
      }
    }
  } else {
    // API Secret 없으면 개발 모드로 통과
    verified = true;
  }

  if (!verified) {
    return NextResponse.json({ error: "결제 검증에 실패했습니다" }, { status: 400 });
  }

  // 2. 구독 기간 계산
  const now = new Date();
  const periodEnd = new Date(now);
  switch (billingCycle || "monthly") {
    case "quarterly": periodEnd.setMonth(periodEnd.getMonth() + 3); break;
    case "yearly": periodEnd.setFullYear(periodEnd.getFullYear() + 1); break;
    default: periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // 3. 파트너 수익 분배
  let partnerId: string | null = null;
  let partnerUserId: string | null = null;
  let partnerShare = 0;
  let platformShare = amount;

  // Get user profile
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .single();

  const partnerRef = referralCode || profile?.referred_by;

  if (partnerRef) {
    // Try referral code first
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
    // 4. Transaction 기록
    await serviceClient.from("transactions").insert({
      type: "subscription_payment",
      user_id: user.id,
      partner_id: partnerId,
      amount,
      currency: "KRW",
      status: "completed",
      payment_method: "card",
      pg_transaction_id: pgTransactionId,
      description: `${tier.toUpperCase()} ${billingCycle || "monthly"} 구독 결제`,
    });

    // 5. Subscription 생성
    if (partnerId) {
      const { data: product } = await serviceClient
        .from("products")
        .select("id")
        .eq("partner_id", partnerId)
        .limit(1)
        .single();

      const productId = product?.id;
      if (productId) {
        await serviceClient.from("subscriptions").insert({
          user_id: user.id,
          product_id: productId,
          partner_id: partnerId,
          status: "active",
          billing_cycle: billingCycle || "monthly",
          amount_paid: amount,
          partner_share: partnerShare,
          platform_share: platformShare,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          auto_renew: true,
        });
      }
    }

    // 6. Profile 업데이트
    await serviceClient
      .from("profiles")
      .update({
        subscription_tier: tier,
        subscription_expires_at: periodEnd.toISOString(),
        referred_by: partnerUserId || profile?.referred_by,
      })
      .eq("id", user.id);

    // 7. 파트너 수익 업데이트
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
    }

    // 8. 알림
    await serviceClient.from("notifications").insert({
      user_id: user.id,
      type: "subscription",
      title: "결제 완료! 🎉",
      body: `${tier.toUpperCase()} 구독이 시작되었습니다. ${periodEnd.toLocaleDateString("ko-KR")}까지 이용 가능합니다.`,
    });

    return NextResponse.json({
      success: true,
      tier,
      expiresAt: periodEnd.toISOString(),
      orderId,
      partnerShare,
      platformShare,
    });
  } catch (error) {
    console.error("Payment process error:", error);
    return NextResponse.json(
      { error: "결제 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

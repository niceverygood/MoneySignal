import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_PRICES } from "@/lib/portone";

export async function POST(request: NextRequest) {
  try {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  const { tier, amount, billingCycle, paymentMethod, paymentId } = await request.json();

  if (!tier || amount === undefined || amount === null) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 });
  }

  // Validate tier
  const validTiers = ["basic", "pro", "premium", "bundle"];
  if (!validTiers.includes(tier)) {
    return NextResponse.json({ error: "유효하지 않은 구독 등급" }, { status: 400 });
  }

  // Validate amount
  if (typeof amount !== "number" || (!Number.isFinite(amount)) || amount < 0 || amount > 5000000) {
    return NextResponse.json({ error: "유효하지 않은 결제 금액입니다" }, { status: 400 });
  }

  // Validate amount matches plan price (무료 체험 제외)
  if (amount > 0) {
    const expectedPrice = PLAN_PRICES[tier]?.[billingCycle || "monthly"];
    if (expectedPrice && amount !== expectedPrice) {
      return NextResponse.json({ error: "결제 금액이 플랜 가격과 일치하지 않습니다" }, { status: 400 });
    }
  }

  // PortOne 서버 측 결제 검증 (유료 결제만)
  if (amount > 0 && paymentId) {
    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "결제 시스템 설정 오류" }, { status: 500 });
    }

    if (apiSecret) {
      const verifyRes = await fetch(
        `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
        { headers: { Authorization: `PortOne ${apiSecret}` } }
      );

      if (verifyRes.ok) {
        const paymentData = await verifyRes.json();
        if (paymentData.amount?.total !== amount || paymentData.status !== "PAID") {
          console.error("[subscribe] Payment verification failed:", {
            expected: amount, actual: paymentData.amount?.total, status: paymentData.status,
          });
          return NextResponse.json({ error: "결제 검증에 실패했습니다" }, { status: 400 });
        }
      } else {
        console.error("[subscribe] PortOne verify error:", await verifyRes.text());
        return NextResponse.json({ error: "결제 검증에 실패했습니다" }, { status: 400 });
      }
    }
  }

  // Get user profile
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "프로필을 찾을 수 없습니다" }, { status: 404 });
  }

  // Calculate period
  const now = new Date();
  const periodEnd = new Date(now);
  switch (billingCycle || "monthly") {
    case "quarterly": periodEnd.setMonth(periodEnd.getMonth() + 3); break;
    case "yearly": periodEnd.setFullYear(periodEnd.getFullYear() + 1); break;
    default: periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  try {
    // 1. Create transaction
    await serviceClient.from("transactions").insert({
      type: "subscription_payment",
      user_id: user.id,
      amount,
      currency: "KRW",
      status: "completed",
      payment_method: paymentMethod || "card",
      pg_transaction_id: paymentId || null,
      description: `${tier.toUpperCase()} 구독 (${billingCycle || "monthly"})`,
    });

    // 2. Update user profile tier
    await serviceClient
      .from("profiles")
      .update({
        subscription_tier: tier,
        subscription_expires_at: periodEnd.toISOString(),
      })
      .eq("id", user.id);

    // 3. Notify user
    await serviceClient.from("notifications").insert({
      user_id: user.id,
      type: "subscription",
      title: "구독 완료!",
      body: `${tier.toUpperCase()} 구독이 시작되었습니다. ${periodEnd.toLocaleDateString("ko-KR")}까지 이용 가능합니다.`,
    });

    return NextResponse.json({
      success: true,
      tier,
      expiresAt: periodEnd.toISOString(),
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "구독 처리 중 오류 발생" }, { status: 500 });
  }
  } catch (outerError) {
    console.error("[subscribe] Outer error:", outerError);
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

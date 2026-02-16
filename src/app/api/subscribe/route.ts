import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { tier, amount, referralCode, billingCycle, paymentMethod } = await request.json();

  if (!tier || !amount) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 });
  }

  // Validate tier
  const validTiers = ["basic", "pro", "premium", "bundle"];
  if (!validTiers.includes(tier)) {
    return NextResponse.json({ error: "유효하지 않은 구독 등급" }, { status: 400 });
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

  // Find partner via referral code or existing referred_by
  let partnerId: string | null = null;
  let partnerUserId: string | null = null;
  let partnerShare = 0;
  let platformShare = amount;

  if (referralCode) {
    const { data: partner } = await serviceClient
      .from("partners")
      .select("id, user_id, revenue_share_rate, is_active")
      .eq("referral_code", referralCode.toUpperCase())
      .eq("is_active", true)
      .single();

    if (partner) {
      partnerId = partner.id;
      partnerUserId = partner.user_id;
      partnerShare = Math.round(amount * partner.revenue_share_rate);
      platformShare = amount - partnerShare;
    }
  } else if (profile.referred_by) {
    const { data: partner } = await serviceClient
      .from("partners")
      .select("id, user_id, revenue_share_rate")
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

  try {
    // 1. Create transaction
    await serviceClient.from("transactions").insert({
      type: "subscription_payment",
      user_id: user.id,
      partner_id: partnerId,
      amount,
      currency: "KRW",
      status: "completed",
      payment_method: paymentMethod || "card",
      description: `${tier.toUpperCase()} 구독 (${billingCycle || "monthly"})`,
    });

    // 2. Create subscription record
    if (partnerId) {
      // Find or create a default product for this partner
      let { data: product } = await serviceClient
        .from("products")
        .select("id")
        .eq("partner_id", partnerId)
        .limit(1)
        .single();

      if (!product) {
        // Create a default product
        const { data: newProduct } = await serviceClient
          .from("products")
          .insert({
            partner_id: partnerId,
            name: `${tier} 구독`,
            slug: tier,
            category: "bundle",
            price_monthly: amount,
            description: `${tier} 등급 구독`,
            features: [],
          })
          .select()
          .single();
        product = newProduct;
      }

      if (product) {
        await serviceClient.from("subscriptions").insert({
          user_id: user.id,
          product_id: product.id,
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

    // 3. Update user profile tier
    await serviceClient
      .from("profiles")
      .update({
        subscription_tier: tier,
        subscription_expires_at: periodEnd.toISOString(),
        referred_by: partnerUserId || profile.referred_by,
      })
      .eq("id", user.id);

    // 4. Update partner revenue if applicable
    if (partnerId) {
      // Increment partner revenue
      const { data: partner } = await serviceClient
        .from("partners")
        .select("total_revenue, available_balance, subscriber_count")
        .eq("id", partnerId)
        .single();

      if (partner) {
        await serviceClient
          .from("partners")
          .update({
            total_revenue: Number(partner.total_revenue) + amount,
            available_balance: Number(partner.available_balance) + partnerShare,
            subscriber_count: partner.subscriber_count + 1,
          })
          .eq("id", partnerId);
      }

      // Notify partner
      if (partnerUserId) {
        await serviceClient.from("notifications").insert({
          user_id: partnerUserId,
          type: "subscription",
          title: "새 구독자!",
          body: `새 구독자가 ${tier.toUpperCase()}을 구독했습니다. (+${partnerShare.toLocaleString()}원)`,
        });
      }
    }

    // 5. Notify user
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
      partnerShare,
      platformShare,
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "구독 처리 중 오류 발생" }, { status: 500 });
  }
}

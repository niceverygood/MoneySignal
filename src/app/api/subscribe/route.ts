import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // Verify user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, billingCycle, paymentMethod } = await request.json();

  if (!productId || !billingCycle) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Fetch product
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*, partners(*)")
    .eq("id", productId)
    .eq("is_active", true)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Calculate price
  let amount: number;
  switch (billingCycle) {
    case "quarterly":
      amount = product.price_quarterly || product.price_monthly * 3;
      break;
    case "yearly":
      amount = product.price_yearly || product.price_monthly * 12;
      break;
    default:
      amount = product.price_monthly;
  }

  // Calculate period
  const now = new Date();
  const periodEnd = new Date(now);
  switch (billingCycle) {
    case "quarterly":
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      break;
    case "yearly":
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Calculate revenue share
  const partner = product.partners;
  const revenueShareRate = partner.revenue_share_rate || 0.8;
  const partnerShare = Math.round(amount * revenueShareRate);
  const platformShare = amount - partnerShare;

  // Determine subscription tier
  const categoryTierMap: Record<string, string> = {
    coin_spot: "basic",
    coin_futures: "pro",
    overseas_futures: "premium",
    kr_stock: "basic",
    bundle: "bundle",
  };
  const newTier = categoryTierMap[product.category] || "basic";

  try {
    // 1. Create transaction
    const { error: txError } = await serviceClient
      .from("transactions")
      .insert({
        type: "subscription_payment",
        user_id: user.id,
        partner_id: partner.id,
        amount,
        currency: "KRW",
        status: "completed",
        payment_method: paymentMethod || "card",
        description: `${product.name} ${billingCycle} 구독`,
      });

    if (txError) throw txError;

    // 2. Create subscription
    const { error: subError } = await serviceClient
      .from("subscriptions")
      .insert({
        user_id: user.id,
        product_id: productId,
        partner_id: partner.id,
        status: "active",
        billing_cycle: billingCycle,
        amount_paid: amount,
        partner_share: partnerShare,
        platform_share: platformShare,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        auto_renew: true,
      });

    if (subError) throw subError;

    // 3. Update user profile tier
    const { data: currentProfile } = await serviceClient
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const tierOrder = ["free", "basic", "pro", "premium", "bundle"];
    const currentTierIdx = tierOrder.indexOf(
      currentProfile?.subscription_tier || "free"
    );
    const newTierIdx = tierOrder.indexOf(newTier);

    if (newTierIdx > currentTierIdx) {
      await serviceClient
        .from("profiles")
        .update({
          subscription_tier: newTier,
          subscription_expires_at: periodEnd.toISOString(),
        })
        .eq("id", user.id);
    }

    // 4. Update partner revenue
    await serviceClient
      .from("partners")
      .update({
        total_revenue: partner.total_revenue + amount,
        available_balance: partner.available_balance + partnerShare,
        subscriber_count: partner.subscriber_count + 1,
      })
      .eq("id", partner.id);

    // 5. Create notifications
    await serviceClient.from("notifications").insert([
      {
        user_id: user.id,
        type: "subscription",
        title: "구독 완료",
        body: `${product.name} 구독이 시작되었습니다. ${periodEnd.toLocaleDateString("ko-KR")}까지 이용 가능합니다.`,
      },
      {
        user_id: partner.user_id,
        type: "subscription",
        title: "새 구독자",
        body: `새로운 구독자가 ${product.name}을 구독했습니다. (+${partnerShare.toLocaleString()}원)`,
      },
    ]);

    return NextResponse.json({
      success: true,
      subscription: {
        tier: newTier,
        expiresAt: periodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json(
      { error: "구독 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// GET /api/cron/auto-billing
// 매일 00:00 UTC (KST 09:00) 실행
// 만료 예정 구독 자동 재결제 + 실패 재시도
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  chargeBillingKey,
  generateOrderId,
  PLAN_PRICES,
  calculatePeriodEnd,
} from "@/lib/portone";

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();
  const results = { charged: 0, failed: 0, gaveUp: 0, skipped: 0 };

  // ============================================
  // 1. D-3 첫 시도: 만료 3일 이내 + retry_count=0
  // ============================================
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: firstAttempts } = await supabase
    .from("subscriptions")
    .select("*, billing_keys!billing_key_id(*)")
    .eq("status", "active")
    .eq("auto_renew", true)
    .eq("billing_retry_count", 0)
    .not("billing_key_id", "is", null)
    .not("next_billing_at", "is", null)
    .lte("next_billing_at", threeDaysLater.toISOString());

  // ============================================
  // 2. 재시도: retry_count 1~2, 마지막 실패로부터 24h+ 경과
  // ============================================
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: retryAttempts } = await supabase
    .from("subscriptions")
    .select("*, billing_keys!billing_key_id(*)")
    .eq("status", "active")
    .eq("auto_renew", true)
    .not("billing_key_id", "is", null)
    .gt("billing_retry_count", 0)
    .lt("billing_retry_count", 3)
    .lte("billing_failed_at", oneDayAgo.toISOString());

  const targets = [...(firstAttempts || []), ...(retryAttempts || [])];

  for (const sub of targets) {
    const billingKeyRecord = sub.billing_keys;
    if (!billingKeyRecord || !billingKeyRecord.billing_key) {
      results.skipped++;
      continue;
    }

    const tier = sub.tier || "pro";
    const cycle = sub.billing_cycle || "monthly";
    const prices = PLAN_PRICES[tier];
    if (!prices || !prices[cycle]) {
      console.error(`[auto-billing] Invalid plan: tier=${tier}, cycle=${cycle}, sub=${sub.id}`);
      results.skipped++;
      continue;
    }

    const amount = prices[cycle];
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
    const orderName = `머니시그널 ${tierNames[tier] || tier} ${cycleLabels[cycle] || cycle} 자동결제`;

    const chargeResult = await chargeBillingKey({
      billingKey: billingKeyRecord.billing_key,
      paymentId,
      orderName,
      amount,
    });

    if (chargeResult.success) {
      // === 성공 처리 ===
      const newPeriodEnd = calculatePeriodEnd(cycle, now);

      // subscriptions 업데이트
      await supabase
        .from("subscriptions")
        .update({
          current_period_start: now.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          next_billing_at: newPeriodEnd.toISOString(),
          last_billing_at: now.toISOString(),
          billing_retry_count: 0,
          billing_failed_at: null,
          amount_paid: amount,
        })
        .eq("id", sub.id);

      // profiles 만료일 연장
      await supabase
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_expires_at: newPeriodEnd.toISOString(),
        })
        .eq("id", sub.user_id);

      // transactions 기록
      await supabase.from("transactions").insert({
        type: "subscription_payment",
        user_id: sub.user_id,
        partner_id: sub.partner_id,
        amount,
        currency: "KRW",
        status: "completed",
        payment_method: "billing_key",
        pg_transaction_id: chargeResult.pgTransactionId || paymentId,
        description: `${tier.toUpperCase()} ${cycleLabels[cycle] || cycle} 자동결제`,
      });

      // 파트너 수익 업데이트
      if (sub.partner_id) {
        const { data: partner } = await supabase
          .from("partners")
          .select("revenue_share_rate, total_revenue, available_balance")
          .eq("id", sub.partner_id)
          .single();

        if (partner) {
          const partnerShare = Math.round(amount * partner.revenue_share_rate);
          await supabase
            .from("partners")
            .update({
              total_revenue: Number(partner.total_revenue) + amount,
              available_balance: Number(partner.available_balance) + partnerShare,
            })
            .eq("id", sub.partner_id);
        }
      }

      // 결제 성공 알림
      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        type: "subscription",
        title: "자동결제 완료",
        body: `${tier.toUpperCase()} 구독이 ${newPeriodEnd.toLocaleDateString("ko-KR")}까지 연장되었습니다.`,
      });

      results.charged++;
    } else {
      // === 실패 처리 ===
      const newRetryCount = (sub.billing_retry_count || 0) + 1;

      if (newRetryCount >= 3) {
        // 3회 실패 → 자동갱신 중단
        await supabase
          .from("subscriptions")
          .update({
            auto_renew: false,
            billing_retry_count: newRetryCount,
            billing_failed_at: now.toISOString(),
          })
          .eq("id", sub.id);

        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          type: "subscription",
          title: "자동결제 최종 실패",
          body: `${tier.toUpperCase()} 구독 자동결제가 3회 실패하여 중단되었습니다. 카드 정보를 확인하고 재구독해주세요.`,
          data: { action: "resubscribe", url: "/app/subscribe" },
        });

        results.gaveUp++;
      } else {
        // 재시도 카운트 증가
        await supabase
          .from("subscriptions")
          .update({
            billing_retry_count: newRetryCount,
            billing_failed_at: now.toISOString(),
          })
          .eq("id", sub.id);

        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          type: "subscription",
          title: "자동결제 실패",
          body: `${tier.toUpperCase()} 구독 자동결제에 실패했습니다. (${newRetryCount}/3회) 카드 정보를 확인해주세요.`,
          data: { action: "check_card", url: "/app/my" },
        });

        results.failed++;
      }

      console.error(
        `[auto-billing] Failed: sub=${sub.id}, retry=${newRetryCount}, reason=${chargeResult.failureReason}`
      );
    }
  }

  console.log(
    `[auto-billing] Charged: ${results.charged}, Failed: ${results.failed}, GaveUp: ${results.gaveUp}, Skipped: ${results.skipped}`
  );

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    ...results,
  });
}

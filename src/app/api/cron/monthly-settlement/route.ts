// GET /api/cron/monthly-settlement
// 매월 1일 01:00 KST (16:00 UTC 전월 말) 실행
// 지난달 정산 계산 + 파트너별 정산 리포트 생성
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";
import dayjs from "dayjs";

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
  const now = dayjs();

  // 지난달 기간
  const lastMonth = now.subtract(1, "month");
  const periodStart = lastMonth.startOf("month").toISOString();
  const periodEnd = lastMonth.endOf("month").toISOString();
  const periodLabel = lastMonth.format("YYYY년 MM월");

  // ============================================
  // 1. 지난달 모든 구독 결제 조회
  // ============================================
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, partners(id, brand_name, user_id, revenue_share_rate, available_balance, total_revenue)")
    .eq("type", "subscription_payment")
    .eq("status", "completed")
    .gte("created_at", periodStart)
    .lte("created_at", periodEnd);

  if (!transactions || transactions.length === 0) {
    return NextResponse.json({
      success: true,
      message: `${periodLabel} 거래 없음`,
      periodStart,
      periodEnd,
    });
  }

  // ============================================
  // 2. 파트너별 정산 집계
  // ============================================
  const partnerSettlements: Record<string, {
    partnerId: string;
    partnerUserId: string;
    brandName: string;
    totalRevenue: number;
    partnerShare: number;
    platformShare: number;
    transactionCount: number;
    revenueShareRate: number;
  }> = {};

  let totalPlatformRevenue = 0;
  let totalGrossRevenue = 0;

  for (const tx of transactions) {
    totalGrossRevenue += tx.amount;

    if (tx.partner_id && tx.partners) {
      const pid = tx.partner_id;
      const rate = Number(tx.partners.revenue_share_rate) || 0.8;
      const partnerShare = Math.round(tx.amount * rate);
      const platformShare = tx.amount - partnerShare;
      totalPlatformRevenue += platformShare;

      if (!partnerSettlements[pid]) {
        partnerSettlements[pid] = {
          partnerId: pid,
          partnerUserId: tx.partners.user_id,
          brandName: tx.partners.brand_name,
          totalRevenue: 0,
          partnerShare: 0,
          platformShare: 0,
          transactionCount: 0,
          revenueShareRate: rate,
        };
      }
      partnerSettlements[pid].totalRevenue += tx.amount;
      partnerSettlements[pid].partnerShare += partnerShare;
      partnerSettlements[pid].platformShare += platformShare;
      partnerSettlements[pid].transactionCount += 1;
    } else {
      totalPlatformRevenue += tx.amount;
    }
  }

  // ============================================
  // 3. 파트너별 정산 기록 저장 + 알림
  // ============================================
  const settlementResults = [];

  for (const settlement of Object.values(partnerSettlements)) {
    // settlement_records 테이블에 기록
    const { error: insertError } = await supabase
      .from("settlement_records")
      .insert({
        partner_id: settlement.partnerId,
        period_label: periodLabel,
        period_start: periodStart,
        period_end: periodEnd,
        gross_revenue: settlement.totalRevenue,
        partner_share: settlement.partnerShare,
        platform_share: settlement.platformShare,
        transaction_count: settlement.transactionCount,
        revenue_share_rate: settlement.revenueShareRate,
        status: "completed",
      });

    if (insertError) {
      console.error(`[Settlement] Insert error for partner ${settlement.partnerId}:`, insertError);
    }

    // 파트너 통계 업데이트 (available_balance에 이번달 정산액 반영)
    // 이미 결제 시점에 실시간으로 반영되므로 여기서는 확인만
    settlementResults.push({
      brandName: settlement.brandName,
      totalRevenue: settlement.totalRevenue,
      partnerShare: settlement.partnerShare,
      platformShare: settlement.platformShare,
    });

    // 파트너에게 정산 알림 발송
    await supabase.from("notifications").insert({
      user_id: settlement.partnerUserId,
      type: "payout",
      title: `${periodLabel} 정산 완료`,
      body: `${periodLabel} 정산: 총 매출 ${settlement.totalRevenue.toLocaleString()}원 / 정산 금액 ${settlement.partnerShare.toLocaleString()}원`,
      data: { period: periodLabel, amount: settlement.partnerShare },
    });

    // 텔레그램 정산 알림
    const { data: tgConn } = await supabase
      .from("telegram_connections")
      .select("telegram_chat_id")
      .eq("user_id", settlement.partnerUserId)
      .eq("is_active", true)
      .single();

    if (tgConn && process.env.TELEGRAM_BOT_TOKEN) {
      await sendTelegramMessage(
        tgConn.telegram_chat_id,
        `💰 <b>${periodLabel} 정산 안내</b>\n\n` +
        `총 매출: ${settlement.totalRevenue.toLocaleString()}원\n` +
        `파트너 정산: <b>${settlement.partnerShare.toLocaleString()}원</b> (${Math.round(settlement.revenueShareRate * 100)}%)\n` +
        `플랫폼 수익: ${settlement.platformShare.toLocaleString()}원\n\n` +
        `출금 신청: ${process.env.NEXT_PUBLIC_SITE_URL}/partner/withdraw`
      ).catch(() => null);
    }
  }

  // ============================================
  // 4. 관리자에게 월간 정산 요약 알림
  // ============================================
  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (adminProfiles) {
    for (const admin of adminProfiles) {
      await supabase.from("notifications").insert({
        user_id: admin.id,
        type: "system",
        title: `${periodLabel} 월간 정산 완료`,
        body: `총 매출: ${totalGrossRevenue.toLocaleString()}원 | 플랫폼 수익: ${totalPlatformRevenue.toLocaleString()}원 | 파트너 수: ${Object.keys(partnerSettlements).length}명`,
        data: { period: periodLabel, grossRevenue: totalGrossRevenue, platformRevenue: totalPlatformRevenue },
      });
    }
  }

  console.log(`[Monthly Settlement] ${periodLabel} 완료. 총 매출: ${totalGrossRevenue}, 플랫폼: ${totalPlatformRevenue}`);

  return NextResponse.json({
    success: true,
    periodLabel,
    periodStart,
    periodEnd,
    summary: {
      totalGrossRevenue,
      totalPlatformRevenue,
      totalPartnerRevenue: totalGrossRevenue - totalPlatformRevenue,
      transactionCount: transactions.length,
      partnerCount: Object.keys(partnerSettlements).length,
    },
    settlements: settlementResults,
  });
}

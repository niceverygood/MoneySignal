// GET /api/cron/subscription-check
// 매일 00:00 KST (15:00 UTC) 실행
// 만료된 구독 자동 처리 + 구독 만료 알림 발송
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";

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
  const results = { expired: 0, expiringSoon: 0, notified: 0 };

  // ============================================
  // 1. 만료된 구독 처리 (subscription_expires_at < now)
  // ============================================
  const { data: expiredUsers } = await supabase
    .from("profiles")
    .select("id, email, display_name, subscription_tier, subscription_expires_at")
    .not("subscription_tier", "eq", "free")
    .lt("subscription_expires_at", now.toISOString());

  if (expiredUsers && expiredUsers.length > 0) {
    for (const user of expiredUsers) {
      // 구독 상태를 free로 전환
      await supabase
        .from("profiles")
        .update({
          subscription_tier: "free",
          subscription_expires_at: null,
        })
        .eq("id", user.id);

      // subscriptions 테이블도 expired 처리
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", user.id)
        .eq("status", "active")
        .lt("current_period_end", now.toISOString());

      // 만료 알림
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "subscription",
        title: "구독이 만료되었습니다",
        body: `${user.subscription_tier?.toUpperCase()} 구독이 만료되었습니다. 계속 이용하려면 재구독해주세요.`,
        data: { action: "resubscribe", url: "/app/subscribe" },
      });

      // 텔레그램 알림 (연결된 경우)
      const { data: tgConn } = await supabase
        .from("telegram_connections")
        .select("telegram_chat_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (tgConn && process.env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramMessage(
          tgConn.telegram_chat_id,
          `⚠️ <b>구독 만료 안내</b>\n\n${user.subscription_tier?.toUpperCase()} 구독이 만료되었습니다.\n재구독: ${process.env.NEXT_PUBLIC_SITE_URL}/app/subscribe`
        ).catch(() => null);
        results.notified++;
      }

      results.expired++;
    }
  }

  // ============================================
  // 2. 3일 후 만료 예정 알림 (D-3 알림)
  // ============================================
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const { data: expiringUsers } = await supabase
    .from("profiles")
    .select("id, email, display_name, subscription_tier, subscription_expires_at")
    .not("subscription_tier", "eq", "free")
    .gt("subscription_expires_at", now.toISOString())
    .lt("subscription_expires_at", threeDaysLater.toISOString());

  if (expiringUsers && expiringUsers.length > 0) {
    for (const user of expiringUsers) {
      const expiresAt = new Date(user.subscription_expires_at!);
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 알림 중복 방지: 오늘 이미 보낸 경우 스킵
      const todayStr = now.toISOString().split("T")[0];
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "subscription")
        .ilike("title", "%만료 예정%")
        .gte("created_at", `${todayStr}T00:00:00`)
        .single();

      if (existingNotif) continue;

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "subscription",
        title: `구독 만료 ${daysLeft}일 전`,
        body: `${user.subscription_tier?.toUpperCase()} 구독이 ${daysLeft}일 후 만료됩니다. 자동 갱신을 확인해주세요.`,
        data: { action: "check_subscription", url: "/app/my" },
      });

      // 텔레그램 D-3 알림
      const { data: tgConn } = await supabase
        .from("telegram_connections")
        .select("telegram_chat_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (tgConn && process.env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramMessage(
          tgConn.telegram_chat_id,
          `📅 <b>구독 만료 ${daysLeft}일 전</b>\n\n${user.subscription_tier?.toUpperCase()} 구독이 ${expiresAt.toLocaleDateString("ko-KR")}에 만료됩니다.`
        ).catch(() => null);
        results.notified++;
      }

      results.expiringSoon++;
    }
  }

  console.log(`[Subscription Check] Expired: ${results.expired}, Expiring Soon: ${results.expiringSoon}, Notified: ${results.notified}`);

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    ...results,
  });
}

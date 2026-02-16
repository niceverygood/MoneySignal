import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;

    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const username = message.from.username || null;

    if (text === "/start") {
      await handleStart(chatId);
    } else if (text === "/status") {
      await handleStatus(chatId);
    } else if (text === "/stop") {
      await handleStop(chatId);
    } else if (/^[A-Z0-9]{6}$/.test(text)) {
      await handleLinkCode(chatId, text, username);
    } else {
      await sendTelegramMessage(
        chatId,
        [
          "사용 가능한 명령어:",
          "/start - 시작하기",
          "/status - 연결 상태 확인",
          "/stop - 알림 중지",
          "",
          "또는 MoneySignal 앱에서 받은 6자리 연결 코드를 입력하세요.",
        ].join("\n")
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function handleStart(chatId: number) {
  const supabase = await createServiceClient();

  // Check if already connected
  const { data: existing } = await supabase
    .from("telegram_connections")
    .select("id, is_active")
    .eq("telegram_chat_id", chatId)
    .single();

  if (existing?.is_active) {
    await sendTelegramMessage(
      chatId,
      [
        "✅ 이미 MoneySignal에 연결되어 있습니다!",
        "",
        "/status 로 현재 상태를 확인하세요.",
      ].join("\n")
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      "👋 <b>MoneySignal 알림 봇</b>에 오신 것을 환영합니다!",
      "",
      "AI 시그널 알림을 텔레그램으로 받아보세요.",
      "",
      "📌 <b>연결 방법:</b>",
      "1. MoneySignal 앱 → 내 정보 → 텔레그램 연결",
      "2. 화면에 표시된 <b>6자리 코드</b>를 여기에 입력",
      "",
      "코드를 입력하면 자동으로 연결됩니다.",
    ].join("\n")
  );
}

async function handleStatus(chatId: number) {
  const supabase = await createServiceClient();

  const { data: connection } = await supabase
    .from("telegram_connections")
    .select(`
      is_active,
      notification_settings,
      connected_at,
      user_id
    `)
    .eq("telegram_chat_id", chatId)
    .single();

  if (!connection) {
    await sendTelegramMessage(
      chatId,
      [
        "❌ 아직 MoneySignal에 연결되지 않았습니다.",
        "",
        "앱에서 연결 코드를 발급받은 후 여기에 입력하세요.",
        "/start 로 자세한 안내를 확인하세요.",
      ].join("\n")
    );
    return;
  }

  // Get user profile for tier info
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, display_name")
    .eq("id", connection.user_id)
    .single();

  const tierLabels: Record<string, string> = {
    free: "무료",
    basic: "베이직",
    pro: "프로",
    premium: "프리미엄",
    bundle: "번들",
  };

  const settings = connection.notification_settings as Record<string, boolean>;
  const settingLabels = [
    settings?.new_signal !== false ? "✅ 새 시그널" : "❌ 새 시그널",
    settings?.tp_hit !== false ? "✅ TP 도달" : "❌ TP 도달",
    settings?.sl_hit !== false ? "✅ SL 도달" : "❌ SL 도달",
    settings?.daily_summary !== false ? "✅ 일일 요약" : "❌ 일일 요약",
  ];

  await sendTelegramMessage(
    chatId,
    [
      `📊 <b>MoneySignal 연결 상태</b>`,
      ``,
      `👤 ${profile?.display_name || "사용자"}`,
      `🏷 구독: ${tierLabels[profile?.subscription_tier || "free"] || "무료"}`,
      `📡 상태: ${connection.is_active ? "활성" : "비활성"}`,
      `📅 연결일: ${new Date(connection.connected_at).toLocaleDateString("ko-KR")}`,
      ``,
      `<b>알림 설정:</b>`,
      ...settingLabels,
      ``,
      `알림 설정 변경은 앱에서 가능합니다.`,
    ].join("\n")
  );
}

async function handleStop(chatId: number) {
  const supabase = await createServiceClient();

  const { data: connection } = await supabase
    .from("telegram_connections")
    .select("id, is_active")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!connection) {
    await sendTelegramMessage(chatId, "연결된 계정이 없습니다.");
    return;
  }

  if (!connection.is_active) {
    await sendTelegramMessage(chatId, "이미 알림이 중지된 상태입니다.");
    return;
  }

  await supabase
    .from("telegram_connections")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", connection.id);

  await sendTelegramMessage(
    chatId,
    [
      "🔇 알림이 중지되었습니다.",
      "",
      "다시 활성화하려면 앱에서 설정하거나,",
      "여기에 새 연결 코드를 입력하세요.",
    ].join("\n")
  );
}

async function handleLinkCode(chatId: number, code: string, username: string | null) {
  const supabase = await createServiceClient();

  // Find valid, unused code
  const { data: linkCode } = await supabase
    .from("telegram_link_codes")
    .select("*")
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!linkCode) {
    await sendTelegramMessage(
      chatId,
      [
        "❌ 유효하지 않거나 만료된 코드입니다.",
        "",
        "앱에서 새 코드를 발급받아 주세요.",
      ].join("\n")
    );
    return;
  }

  // Mark code as used
  await supabase
    .from("telegram_link_codes")
    .update({ used: true })
    .eq("code", code);

  // Upsert telegram connection
  const { error } = await supabase
    .from("telegram_connections")
    .upsert(
      {
        user_id: linkCode.user_id,
        telegram_chat_id: chatId,
        telegram_username: username,
        is_active: true,
        notification_settings: {
          new_signal: true,
          tp_hit: true,
          sl_hit: true,
          daily_summary: true,
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[Telegram] Link error:", error);
    await sendTelegramMessage(chatId, "연결 중 오류가 발생했습니다. 다시 시도해 주세요.");
    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      "✅ <b>MoneySignal 연결 완료!</b>",
      "",
      "이제 AI 시그널 알림을 텔레그램으로 받을 수 있습니다.",
      "",
      "📌 알림 종류:",
      "• 새 시그널 발생",
      "• TP(익절) 도달",
      "• SL(손절) 도달",
      "• 일일 요약 리포트",
      "",
      "/status 로 연결 상태를 확인하세요.",
      "알림 설정 변경은 앱에서 가능합니다.",
    ].join("\n")
  );
}

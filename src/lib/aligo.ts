// ============================================
// Aligo 카카오 알림톡 API
// ============================================
// Supabase DB http extension을 통해 알리고 API 호출
// (Vercel IP 불일치 문제 해결 — DB 고정 IP에서 직접 호출)
// ============================================

import type { Signal } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

interface AlimtalkRecipient {
  phone: string;
  subject: string;
  message: string;
  buttonUrl?: string;
}

interface AlimtalkResult {
  success: number;
  fail: number;
}

// ============================================
// 단건 알림톡 발송 (Supabase RPC)
// ============================================
export async function sendAlimtalk(
  phone: string,
  tplCode: string,
  subject: string,
  message: string,
  supabase: SupabaseClient,
  buttonUrl?: string
): Promise<boolean> {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const senderKey = process.env.ALIGO_SENDER_KEY;
  const sender = process.env.ALIGO_SENDER;

  if (!apiKey || !userId || !senderKey || !sender) {
    console.warn("[Aligo] Missing env vars (ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_KEY, ALIGO_SENDER)");
    return false;
  }

  try {
    const receivers = [{
      phone,
      subject,
      message,
      ...(buttonUrl ? { buttonUrl } : {}),
    }];

    const { data, error } = await supabase.rpc("send_alimtalk", {
      p_api_key: apiKey,
      p_user_id: userId,
      p_sender_key: senderKey,
      p_sender: sender,
      p_tpl_code: tplCode,
      p_receivers: receivers,
    });

    if (error) {
      console.error("[Aligo] RPC error:", error.message);
      return false;
    }

    console.log(`[Aligo] Sent to ${phone}: ${subject}`, data);
    return true;
  } catch (error) {
    console.error("[Aligo] Error:", error);
    return false;
  }
}

// ============================================
// 대량 알림톡 발송 (Supabase RPC, 내부 500명 분할)
// ============================================
export async function sendBulkAlimtalk(
  tplCode: string,
  recipients: AlimtalkRecipient[],
  supabase: SupabaseClient
): Promise<AlimtalkResult> {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const senderKey = process.env.ALIGO_SENDER_KEY;
  const sender = process.env.ALIGO_SENDER;

  if (!apiKey || !userId || !senderKey || !sender) {
    console.warn("[Aligo] Missing env vars");
    return { success: 0, fail: recipients.length };
  }

  if (recipients.length === 0) {
    return { success: 0, fail: 0 };
  }

  try {
    const { data, error } = await supabase.rpc("send_alimtalk", {
      p_api_key: apiKey,
      p_user_id: userId,
      p_sender_key: senderKey,
      p_sender: sender,
      p_tpl_code: tplCode,
      p_receivers: recipients,
    });

    if (error) {
      console.error("[Aligo] RPC error:", error.message);
      return { success: 0, fail: recipients.length };
    }

    console.log(`[Aligo] Bulk sent via RPC:`, data);

    // RPC 반환값에서 성공/실패 판별
    const batches = data?.batches || [];
    let totalSuccess = 0;
    let totalFail = 0;

    for (const batch of batches) {
      if (batch.status === 200) {
        try {
          const body = typeof batch.body === "string" ? JSON.parse(batch.body) : batch.body;
          if (body?.code === 0) {
            totalSuccess += recipients.length; // 배치당 성공
          } else {
            totalFail += recipients.length;
            console.error("[Aligo] Batch failed:", body?.message || body);
          }
        } catch {
          // body 파싱 실패 시 HTTP 200이면 성공으로 처리
          totalSuccess += recipients.length;
        }
      } else {
        totalFail += recipients.length;
        console.error("[Aligo] Batch HTTP error:", batch.status);
      }
    }

    // batches가 여러 개면 실제 배치 크기로 정규화
    if (batches.length > 1) {
      totalSuccess = Math.min(totalSuccess, recipients.length);
      totalFail = recipients.length - totalSuccess;
    }

    return { success: totalSuccess, fail: totalFail };
  } catch (error) {
    console.error("[Aligo] Bulk send error:", error);
    return { success: 0, fail: recipients.length };
  }
}

// ============================================
// 시그널 알림톡 메시지 포맷
// ============================================
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://money-signal.vercel.app";

export function formatSignalAlimtalk(signal: Signal): {
  subject: string;
  message: string;
  buttonUrl: string;
} {
  const dir = signal.direction === "long" || signal.direction === "buy" ? "매수(LONG)" : "매도(SHORT)";
  const entry = Number(signal.entry_price).toLocaleString("en-US");
  const confidence = signal.confidence || 3;

  let message = `[머니시그널] 새로운 매매 시그널\n\n`;
  message += `${signal.symbol_name || signal.symbol} ${dir} (신뢰도 ${confidence}/5)\n`;
  message += `진입가: ${entry}\n`;

  if (signal.stop_loss) {
    message += `손절가: ${Number(signal.stop_loss).toLocaleString("en-US")}\n`;
  }
  if (signal.take_profit_1) {
    message += `목표가: ${Number(signal.take_profit_1).toLocaleString("en-US")}\n`;
  }

  message += `\n앱에서 상세 분석을 확인하세요.\n\n해당 메시지는 고객님께서 요청하신 매매 시그널 알림이 있을 경우 발송됩니다.`;

  return {
    subject: `[머니시그널] ${signal.symbol_name || signal.symbol} ${dir}`,
    message,
    buttonUrl: `${SITE_URL}/app/signals/${signal.id}`,
  };
}

export function formatTPHitAlimtalk(
  signal: Signal,
  tpLevel: number,
  pnl: number
): { subject: string; message: string; buttonUrl: string } {
  const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);

  return {
    subject: `[머니시그널] ${signal.symbol_name || signal.symbol} TP${tpLevel}도달`,
    message: `[머니시그널] 목표가 도달\n\n${signal.symbol_name || signal.symbol} TP${tpLevel}도달!\n수익률: ${pnlStr}%\n\n앱에서 확인하세요.\n\n해당 메시지는 고객님께서 요청하신 목표가 도달 알림이 있을 경우 발송됩니다.`,
    buttonUrl: `${SITE_URL}/app/signals/${signal.id}`,
  };
}

export function formatSLHitAlimtalk(
  signal: Signal,
  pnl: number
): { subject: string; message: string; buttonUrl: string } {
  const pnlStr = pnl.toFixed(2);

  return {
    subject: `[머니시그널] ${signal.symbol_name || signal.symbol} 손절가 도달`,
    message: `[머니시그널] 손절가 도달\n\n${signal.symbol_name || signal.symbol} 손절가에 도달했습니다.\n손실률: ${pnlStr}%\n\n앱에서 포지션을 확인하세요.\n\n해당 메시지는 고객님께서 요청하신 손절가 도달 알림이 있을 경우 발송됩니다.`,
    buttonUrl: `${SITE_URL}/app/signals/${signal.id}`,
  };
}

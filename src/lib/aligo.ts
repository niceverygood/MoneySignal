// ============================================
// Aligo 카카오 알림톡 API
// ============================================
// 알리고 API를 통한 카카오 알림톡 발송
// 전화번호 기반 1회 최대 500명 발송
// ============================================

import type { Signal } from "@/types";

const ALIGO_API_URL = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";

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
// 단건 알림톡 발송
// ============================================
export async function sendAlimtalk(
  phone: string,
  tplCode: string,
  subject: string,
  message: string,
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
    const params = new URLSearchParams({
      apikey: apiKey,
      userid: userId,
      senderkey: senderKey,
      tpl_code: tplCode,
      sender: sender,
      receiver_1: phone.replace(/-/g, ""),
      subject_1: subject,
      message_1: message,
    });

    if (buttonUrl) {
      params.set("button_1", JSON.stringify({
        button: [{
          name: "앱에서 확인",
          linkType: "WL",
          linkTypeName: "웹링크",
          linkMo: buttonUrl,
          linkPc: buttonUrl,
        }],
      }));
    }

    const res = await fetch(ALIGO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const result = await res.json();

    if (result.code === 0) {
      console.log(`[Aligo] Sent to ${phone}: ${subject}`);
      return true;
    }

    console.error("[Aligo] Send failed:", result.message || result);
    return false;
  } catch (error) {
    console.error("[Aligo] Error:", error);
    return false;
  }
}

// ============================================
// 대량 알림톡 발송 (최대 500명)
// ============================================
export async function sendBulkAlimtalk(
  tplCode: string,
  recipients: AlimtalkRecipient[]
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

  let totalSuccess = 0;
  let totalFail = 0;

  // 500명씩 분할 발송
  const batchSize = 500;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    try {
      const params = new URLSearchParams({
        apikey: apiKey,
        userid: userId,
        senderkey: senderKey,
        tpl_code: tplCode,
        sender: sender,
        testMode: process.env.NODE_ENV === "development" ? "Y" : "N",
      });

      batch.forEach((r, idx) => {
        const n = idx + 1;
        params.set(`receiver_${n}`, r.phone.replace(/-/g, ""));
        params.set(`subject_${n}`, r.subject);
        params.set(`message_${n}`, r.message);
        if (r.buttonUrl) {
          params.set(`button_${n}`, JSON.stringify({
            button: [{
              name: "앱에서 확인",
              linkType: "WL",
              linkTypeName: "웹링크",
              linkMo: r.buttonUrl,
              linkPc: r.buttonUrl,
            }],
          }));
        }
      });

      const res = await fetch(ALIGO_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const result = await res.json();

      if (result.code === 0) {
        totalSuccess += batch.length;
        console.log(`[Aligo] Bulk batch sent: ${batch.length} recipients`);
      } else {
        totalFail += batch.length;
        console.error("[Aligo] Bulk send failed:", result.message || result);
      }
    } catch (error) {
      totalFail += batch.length;
      console.error("[Aligo] Bulk send error:", error);
    }
  }

  return { success: totalSuccess, fail: totalFail };
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
    subject: `[머니시그널] ${signal.symbol_name || signal.symbol} TP${tpLevel} 도달`,
    message: `[머니시그널] 목표가 도달\n\n${signal.symbol_name || signal.symbol} TP${tpLevel} 도달!\n수익률: ${pnlStr}%\n\n앱에서 확인하세요.\n\n해당 메시지는 고객님께서 요청하신 목표가 도달 알림이 있을 경우 발송됩니다.`,
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

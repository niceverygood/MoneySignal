// ============================================
// Kakao Notification Utilities
// ============================================
// 카카오 메시지 발송: 카카오 나에게 보내기 / 친구에게 보내기 API
// Pro 이상 구독자만 사용 가능
// ============================================

import type { Signal } from "@/types";

const KAKAO_API_BASE = "https://kapi.kakao.com";

// ============================================
// 카카오 사용자 액세스 토큰으로 "나에게 보내기"
// 사용자가 kakao 로그인 시 받은 access_token 필요
// ============================================
export async function sendKakaoMessageToMe(
  accessToken: string,
  text: string,
  webUrl?: string
): Promise<boolean> {
  try {
    const template = {
      object_type: "text",
      text: text.substring(0, 200), // 최대 200자
      link: {
        web_url: webUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://moneysignal.io",
        mobile_web_url: webUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://moneysignal.io",
      },
    };

    const res = await fetch(`${KAKAO_API_BASE}/v2/api/talk/memo/default/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `template_object=${encodeURIComponent(JSON.stringify(template))}`,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Kakao] sendKakaoMessageToMe failed:", res.status, err);
      return false;
    }

    const result = await res.json();
    return result.result_code === 0;
  } catch (error) {
    console.error("[Kakao] sendKakaoMessageToMe error:", error);
    return false;
  }
}

// ============================================
// 카카오 앱 어드민 키로 특정 유저 UUID에 메시지 발송
// (카카오 비즈니스 채널 알림톡 방식)
// ============================================
export async function sendKakaoSignalAlert(
  kakaoUserId: string,
  signal: Signal
): Promise<boolean> {
  // 카카오 나에게 보내기는 사용자 access_token이 필요
  // DB에 저장된 kakao_access_token 사용
  // kakaoUserId는 실제로는 저장된 access_token으로 활용
  const text = formatSignalForKakao(signal);
  return sendKakaoMessageToMe(kakaoUserId, text);
}

// ============================================
// 시그널 포맷 (카카오 메시지용, 200자 이내)
// ============================================
export function formatSignalForKakao(signal: Signal): string {
  const dir = signal.direction === "long" || signal.direction === "buy" ? "🟢 LONG" : "🔴 SHORT";
  const entry = Number(signal.entry_price).toLocaleString("en-US");

  let text = `[머니시그널] ${signal.symbol} ${dir} ⭐${signal.confidence}/5\n`;
  text += `진입: ${entry}`;

  if (signal.stop_loss) {
    const slPct = (((Number(signal.stop_loss) - Number(signal.entry_price)) / Number(signal.entry_price)) * 100).toFixed(1);
    text += `  손절: ${Number(signal.stop_loss).toLocaleString("en-US")} (${slPct}%)`;
  }

  if (signal.take_profit_1) {
    const tp1Pct = (((Number(signal.take_profit_1) - Number(signal.entry_price)) / Number(signal.entry_price)) * 100).toFixed(1);
    text += `\nTP1: ${Number(signal.take_profit_1).toLocaleString("en-US")} (+${tp1Pct}%)`;
  }

  if (signal.ai_reasoning) {
    const summary = signal.ai_reasoning.substring(0, 50);
    text += `\n💡 ${summary}...`;
  }

  return text;
}

// ============================================
// 카카오 OAuth 토큰 갱신
// ============================================
export async function refreshKakaoToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
} | null> {
  try {
    const res = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.KAKAO_REST_API_KEY || "",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================
// 카카오 사용자 정보 조회 (연결 후 user_id 저장용)
// ============================================
export async function getKakaoUserInfo(accessToken: string): Promise<{
  id: number;
  kakao_account?: { email?: string; profile?: { nickname?: string } };
} | null> {
  try {
    const res = await fetch(`${KAKAO_API_BASE}/v2/user/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

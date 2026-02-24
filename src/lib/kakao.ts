// ============================================
// Kakao Utilities
// ============================================
// 카카오 소셜 로그인 관련 유틸리티
// 알림톡 발송은 src/lib/aligo.ts로 이전됨
// ============================================

const KAKAO_API_BASE = "https://kapi.kakao.com";

// ============================================
// 카카오 사용자 정보 조회 (카카오 로그인용)
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

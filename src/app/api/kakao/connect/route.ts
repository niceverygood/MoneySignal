// POST /api/kakao/connect
// 카카오 OAuth 코드를 받아서 access_token 발급 + DB 저장
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getKakaoUserInfo } from "@/lib/kakao";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  // 유저 구독 등급 체크 (basic 이상만 카카오 연동)
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tierOrder: Record<string, number> = { free: 0, basic: 1, pro: 2, premium: 3, bundle: 4 };
  if (!profile || (tierOrder[profile.subscription_tier] || 0) < 1) {
    return NextResponse.json({ error: "Basic 이상 구독에서 이용 가능합니다" }, { status: 403 });
  }

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: "인증 코드가 없습니다" }, { status: 400 });

  // 카카오 토큰 발급
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY || "",
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/app/my/kakao/callback`,
      code,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    return NextResponse.json({ error: "카카오 토큰 발급 실패", detail: err }, { status: 400 });
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in, refresh_token_expires_in } = tokenData;

  // 카카오 유저 정보 조회
  const kakaoUser = await getKakaoUserInfo(access_token);
  if (!kakaoUser) {
    return NextResponse.json({ error: "카카오 사용자 정보 조회 실패" }, { status: 400 });
  }

  // DB 저장 (kakao_connections 테이블)
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
  const refreshExpiresAt = refresh_token_expires_in
    ? new Date(Date.now() + refresh_token_expires_in * 1000).toISOString()
    : null;

  const { error: upsertError } = await serviceClient
    .from("kakao_connections")
    .upsert({
      user_id: user.id,
      kakao_user_id: String(kakaoUser.id),
      kakao_access_token: access_token,
      kakao_refresh_token: refresh_token,
      token_expires_at: expiresAt,
      refresh_token_expires_at: refreshExpiresAt,
      kakao_nickname: kakaoUser.kakao_account?.profile?.nickname || null,
      is_active: true,
      notification_settings: { new_signal: true, tp_hit: true, sl_hit: true },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (upsertError) {
    return NextResponse.json({ error: "카카오 연동 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    kakaoNickname: kakaoUser.kakao_account?.profile?.nickname || "카카오 사용자",
  });
}

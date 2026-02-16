import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST: 유저가 운영자 추천코드를 입력하여 연결
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { referralCode } = await request.json();

  if (!referralCode) {
    return NextResponse.json({ error: "추천코드를 입력해주세요" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  // Find partner by referral code
  const { data: partner } = await serviceClient
    .from("partners")
    .select("id, user_id, brand_name, is_active")
    .eq("referral_code", referralCode.toUpperCase())
    .single();

  if (!partner) {
    return NextResponse.json({ error: "유효하지 않은 추천코드입니다" }, { status: 404 });
  }

  if (!partner.is_active) {
    return NextResponse.json({ error: "아직 승인되지 않은 운영자입니다" }, { status: 400 });
  }

  if (partner.user_id === user.id) {
    return NextResponse.json({ error: "자신의 추천코드는 사용할 수 없습니다" }, { status: 400 });
  }

  // Update user's referred_by
  const { error } = await serviceClient
    .from("profiles")
    .update({ referred_by: partner.user_id })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "연결 중 오류가 발생했습니다" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    partnerName: partner.brand_name,
    message: `${partner.brand_name} 운영자와 연결되었습니다!`,
  });
}

// GET: 추천코드 정보 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "코드를 입력해주세요" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("brand_name, bio, subscriber_count, tier, is_active")
    .eq("referral_code", code.toUpperCase())
    .single();

  if (!partner) {
    return NextResponse.json({ error: "유효하지 않은 코드" }, { status: 404 });
  }

  return NextResponse.json({ partner });
}

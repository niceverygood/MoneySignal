import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await request.json();
  const { brandName, channel, subscriberCount, category, bio } = body;

  if (!brandName) {
    return NextResponse.json({ error: "브랜드명을 입력해주세요" }, { status: 400 });
  }

  // Generate unique referral code (6 chars)
  const referralCode = generateReferralCode();
  const brandSlug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const serviceClient = await createServiceClient();

  // Check if already applied
  const { data: existing } = await serviceClient
    .from("partners")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "이미 운영자 신청을 하셨습니다" }, { status: 409 });
  }

  // Create partner record (inactive, pending admin approval)
  const { data: partner, error } = await serviceClient
    .from("partners")
    .insert({
      user_id: user.id,
      brand_name: brandName,
      brand_slug: brandSlug + "-" + referralCode.toLowerCase(),
      referral_code: referralCode,
      bio: bio || `${channel || ""} 운영 | ${subscriberCount || "0"}명`,
      is_active: false,
      tier: "starter",
      revenue_share_rate: 0.80,
    })
    .select()
    .single();

  if (error) {
    console.error("Partner apply error:", error);
    return NextResponse.json({ error: "신청 중 오류가 발생했습니다" }, { status: 500 });
  }

  // Send notification to admin
  const { data: admins } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      type: "system" as const,
      title: "새 운영자 신청",
      body: `${brandName}님이 운영자 신청을 했습니다. 승인/거부를 처리해주세요.`,
      data: { partner_id: partner.id },
    }));
    await serviceClient.from("notifications").insert(notifications);
  }

  return NextResponse.json({
    success: true,
    referralCode,
    message: "운영자 신청이 완료되었습니다. 관리자 승인 후 활동할 수 있습니다.",
  });
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

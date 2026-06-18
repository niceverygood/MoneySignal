import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ============================================
// ⚠️ DEV 전용 테스트 로그인 — 운영에서는 절대 동작하지 않음 (fail-closed)
// NODE_ENV === "production" 이면 무조건 404.
// 고정 테스트 계정을 보장(생성/비번고정/온보딩완료)하고 자격증명을 반환.
// 클라이언트(로그인 페이지의 dev 버튼)가 이 값으로 signInWithPassword 한다.
// ============================================

export const dynamic = "force-dynamic";

const TEST_EMAIL = "tester@moneysignal.dev";
const TEST_PASSWORD = "Tester!2026";
const ALLOWED_TIERS = ["free", "basic", "pro", "premium", "bundle"];

export async function POST(request: Request) {
  // 1) 운영 차단 (fail-closed)
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const tierParam = url.searchParams.get("tier");
  const tier = tierParam && ALLOWED_TIERS.includes(tierParam) ? tierParam : "free";

  try {
    const admin = await createServiceClient();

    // 2) 기존 테스트 유저 찾기 (profiles.email)
    let userId: string | null = null;
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", TEST_EMAIL)
      .maybeSingle();

    if (existing?.id) {
      userId = existing.id;
      // 비밀번호를 항상 알려진 값으로 고정 (이전에 달라졌을 수 있음)
      await admin.auth.admin.updateUserById(existing.id, {
        password: TEST_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return NextResponse.json(
          { error: createErr?.message || "테스트 유저 생성 실패" },
          { status: 500 }
        );
      }
      userId = created.user.id;
    }

    // 3) 프로필 보정: 온보딩 완료 + 테스트 티어 (가입 트리거가 만든 row를 갱신)
    await admin
      .from("profiles")
      .update({ onboarded: true, subscription_tier: tier, display_name: "테스트" })
      .eq("id", userId);

    return NextResponse.json({ email: TEST_EMAIL, password: TEST_PASSWORD, tier });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "테스트 로그인 처리 오류" },
      { status: 500 }
    );
  }
}

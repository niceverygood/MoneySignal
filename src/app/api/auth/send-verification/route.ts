import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "올바른 이메일 형식이 아닙니다." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // auth.users에서 이메일로 기존 유저 확인 (페이지네이션 전체 순회)
    let existingUser = null;
    let page = 1;
    const perPage = 500;

    while (true) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        console.error("[send-verification] listUsers error:", listError);
        return NextResponse.json(
          { error: "서버 오류가 발생했습니다." },
          { status: 500 }
        );
      }

      const found = users.find(u => u.email === trimmedEmail);
      if (found) {
        existingUser = found;
        break;
      }

      if (users.length < perPage) break;
      page++;
    }

    if (existingUser) {
      if (existingUser.email_confirmed_at) {
        // 이메일 인증 완료된 유저 → 이미 가입됨
        return NextResponse.json(
          { error: "이미 가입된 이메일입니다." },
          { status: 409 }
        );
      } else {
        // 미인증 유저 → 삭제 후 재가입 허용
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-verification] Error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

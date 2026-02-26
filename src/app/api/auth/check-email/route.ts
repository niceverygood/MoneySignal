import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { available: false, message: "올바른 이메일 형식이 아닙니다." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.rpc("check_email_available", {
      p_email: email,
    });

    if (error) {
      console.error("[check-email] RPC error:", error);
      return NextResponse.json(
        { available: false, message: "확인 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const available = data === true;

    return NextResponse.json({
      available,
      message: available ? "사용 가능한 이메일입니다." : "이미 가입된 이메일입니다.",
    });
  } catch (err) {
    console.error("[check-email] Error:", err);
    return NextResponse.json(
      { available: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

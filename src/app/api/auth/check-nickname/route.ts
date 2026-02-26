import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const nickname = url.searchParams.get("nickname")?.trim();

    if (!nickname || nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { available: false, message: "닉네임은 2~20자여야 합니다." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", nickname)
      .limit(1);

    if (error) {
      console.error("[check-nickname] DB error:", error);
      return NextResponse.json(
        { available: false, message: "확인 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const available = !data || data.length === 0;

    return NextResponse.json({
      available,
      message: available ? "사용 가능한 닉네임입니다." : "이미 사용 중인 닉네임입니다.",
    });
  } catch (err) {
    console.error("[check-nickname] Error:", err);
    return NextResponse.json(
      { available: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

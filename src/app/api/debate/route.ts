export const maxDuration = 120;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDebate } from "@/lib/debate";

export async function GET(request: Request) {
  // 로그인 필수 — AI 토론은 비용이 드는 유료 가치이므로 익명 남용 차단
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");
  const name = url.searchParams.get("name");
  const scoreStr = url.searchParams.get("score");

  if (!symbol || !name) {
    return NextResponse.json(
      { error: "symbol and name are required" },
      { status: 400 }
    );
  }

  try {
    const avgScore = scoreStr ? parseFloat(scoreStr) : undefined;
    const debate = await generateDebate(symbol, name, avgScore);

    return NextResponse.json({ debate });
  } catch (error) {
    console.error("[Debate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate debate" },
      { status: 500 }
    );
  }
}

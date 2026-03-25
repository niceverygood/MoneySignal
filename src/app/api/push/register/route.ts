import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, platform } = await request.json();

  if (!token || !platform) {
    return NextResponse.json({ error: "token and platform required" }, { status: 400 });
  }

  if (!["ios", "android", "web"].includes(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }

  // Upsert: 같은 유저+토큰이면 업데이트, 새로우면 삽입
  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: "user_id,token" }
    );

  if (error) {
    console.error("[Push Register] Error:", error);
    return NextResponse.json({ error: "Failed to register token" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

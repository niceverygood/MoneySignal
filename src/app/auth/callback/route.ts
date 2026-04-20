import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error_param = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  const redirectTo = searchParams.get("redirectTo") || "/app";

  // OAuth 에러 파라미터가 있는 경우
  if (error_param) {
    const msg = error_description || error_param;
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(msg)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Return to login if error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}

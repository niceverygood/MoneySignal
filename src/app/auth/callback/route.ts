import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error_param = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  const redirectTo = searchParams.get("redirectTo") || "/app";

  // 프록시(Vercel 등) 뒤에서는 origin이 내부 호스트로 잡힐 수 있어 forwarded host 우선 사용
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isLocal = process.env.NODE_ENV === "development";
  const baseUrl =
    !isLocal && forwardedHost
      ? `${forwardedProto || "https"}://${forwardedHost}`
      : origin;

  // OAuth 에러 파라미터가 있는 경우
  if (error_param) {
    const msg = error_description || error_param;
    return NextResponse.redirect(
      `${baseUrl}/auth/login?error=${encodeURIComponent(msg)}`
    );
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const cookieStore = await cookies();

      // 리다이렉트 응답을 먼저 만들어 두고, 세션 쿠키를 이 응답에 직접 부착한다.
      // (Next.js 라우트 핸들러에서 cookies().set()은 새로 만든 redirect 응답에
      //  자동으로 실리지 않으므로, 응답 객체에 직접 set 해야 한 번에 로그인된다.)
      const response = NextResponse.redirect(`${baseUrl}${redirectTo}`);

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // 신규 유저면 온보딩 완료 플래그를 즉시 세우고(반복 라우팅 방지),
        // 명시적 딥링크가 없을 때만 온보딩으로 유도. 딥링크면 플립만 하고 목적지는 유지.
        // (response에 이미 세션 쿠키가 붙어 있으므로 Location 헤더만 바꿔 쿠키를 보존)
        if (exchangeData?.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("onboarded")
            .eq("id", exchangeData.user.id)
            .maybeSingle();
          if (prof && prof.onboarded === false) {
            await supabase.from("profiles").update({ onboarded: true }).eq("id", exchangeData.user.id);
            if (redirectTo === "/app") {
              response.headers.set("Location", `${baseUrl}/app/onboarding`);
            }
          }
        }
        return response;
      }
    }
  }

  // Return to login if error
  return NextResponse.redirect(`${baseUrl}/auth/login?error=auth_failed`);
}

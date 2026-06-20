import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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
        // OAuth 완료 직후 미들웨어 getUser() 타이밍 레이스를 방지한다.
        // 미들웨어는 이 쿠키를 보면 getUser() 없이 즉시 통과시키고 쿠키를 삭제한다.
        // httpOnly: JS에서 위조 불가, maxAge: 30초면 충분.
        response.cookies.set("just_authed", "1", {
          path: "/",
          maxAge: 30,
          httpOnly: true,
          sameSite: "lax",
        });

        // 신규 유저 온보딩 게이트. ⚠️ 중요: 세션 쿠키를 쥔 supabase(auth) 클라이언트를
        // exchange 이후 다시 호출하면 GoTrue가 세션을 재검증하며 응답 쿠키를 덮어버려
        // 첫 /app 진입에 세션이 유실되고 로그인으로 튕긴다(2번째에야 들어가짐).
        // → 온보딩 조회/갱신은 쿠키를 만지지 않는 service-role 클라이언트로 분리하고,
        //    auth 클라이언트는 exchange 이후 절대 재호출하지 않는다.
        if (exchangeData?.user) {
          try {
            const admin = await createServiceClient();
            const { data: prof } = await admin
              .from("profiles")
              .select("onboarded")
              .eq("id", exchangeData.user.id)
              .maybeSingle();
            if (prof && prof.onboarded === false) {
              await admin.from("profiles").update({ onboarded: true }).eq("id", exchangeData.user.id);
              if (redirectTo === "/app") {
                response.headers.set("Location", `${baseUrl}/app/onboarding`);
              }
            }
          } catch {
            // 온보딩 게이트 실패해도 로그인은 정상 진행 (세션 쿠키는 이미 response에 부착됨)
          }
        }
        return response;
      }
    }
  }

  // Return to login if error
  return NextResponse.redirect(`${baseUrl}/auth/login?error=auth_failed`);
}

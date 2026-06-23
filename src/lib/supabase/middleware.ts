import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// getUser()가 세션을 갱신하면 새 토큰 쿠키가 `from` 응답에 실린다.
// 리다이렉트는 새 응답 객체라 그 쿠키를 잃어버리므로, 명시적으로 옮겨준다.
function withCookies(to: NextResponse, from: NextResponse): NextResponse {
  from.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase env vars are missing, just pass through
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  // Public routes that don't need any auth processing
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/manifest.json");

  // For public routes, skip Supabase session refresh to avoid errors
  if (isPublicRoute) {
    return NextResponse.next({ request });
  }

  // Protected routes — require authentication
  const isProtectedRoute =
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin");

  // OAuth 콜백 직후 just_authed 쿠키가 있으면 getUser() 레이스 없이 즉시 통과.
  // 쿠키는 콜백 서버에서만 설정(httpOnly) → JS 위조 불가.
  if (request.cookies.get("just_authed")?.value === "1" && isProtectedRoute) {
    const res = NextResponse.next({ request });
    res.cookies.delete("just_authed");
    return res;
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Refresh session
    let {
      data: { user },
    } = await supabase.auth.getUser();

    // Protected routes — require authentication
    const isProtectedRoute =
      pathname.startsWith("/app") ||
      pathname.startsWith("/admin");

    // 핵심: getUser()는 매 요청마다 Supabase Auth로 네트워크 검증을 한다.
    // 모바일(셀룰러) 환경이나 OAuth 콜백 직후 청크 세션 쿠키가 적용되는 짧은
    // 레이스 구간에서 이 한 번의 호출이 일시적으로 null을 반환하면 유효한
    // 세션이 있어도 로그인으로 튕긴다("한 번에 로그인 안 됨 / 두 번째에 됨").
    // → 세션 쿠키가 실제로 존재하는데 user가 비었으면 '진짜 로그아웃'이 아니라
    //   일시 실패일 가능성이 높으므로 즉시 튕기지 않고 한 번 더 검증한다.
    //   쿠키가 아예 없으면(미로그인) 그대로 즉시 로그인으로 보낸다.
    if (!user && isProtectedRoute) {
      const hasAuthCookie = request.cookies
        .getAll()
        .some((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
      if (hasAuthCookie) {
        const retry = await supabase.auth.getUser();
        user = retry.data.user;
      }
    }

    // Update last_active_at for authenticated users (fire-and-forget, no await)
    if (user) {
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user.id)
        .then(() => {}, () => {});
    }

    if (!user && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("redirectTo", pathname);
      return withCookies(NextResponse.redirect(url), supabaseResponse);
    }

    // Role-based access control — admin 전용
    if (user && pathname.startsWith("/admin")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/app";
        return withCookies(NextResponse.redirect(url), supabaseResponse);
      }
    }

    return supabaseResponse;
  } catch (error) {
    // If Supabase call fails, don't crash — just pass through
    console.error("Middleware error:", error);
    return NextResponse.next({ request });
  }
}

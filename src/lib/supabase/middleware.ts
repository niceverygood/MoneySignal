import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    pathname.startsWith("/p/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/partner/apply") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/manifest.json");

  // For public routes, skip Supabase session refresh to avoid errors
  if (isPublicRoute) {
    return NextResponse.next({ request });
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protected routes — require authentication
    const isProtectedRoute =
      pathname.startsWith("/app") ||
      pathname.startsWith("/partner") ||
      pathname.startsWith("/admin");

    if (!user && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }

    // Role-based access control
    if (user && (pathname.startsWith("/partner") || pathname.startsWith("/admin"))) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (pathname.startsWith("/admin") && profile?.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/app";
        return NextResponse.redirect(url);
      }

      if (
        pathname.startsWith("/partner") &&
        !pathname.startsWith("/partner/apply") &&
        profile?.role !== "partner" &&
        profile?.role !== "admin"
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/app";
        return NextResponse.redirect(url);
      }
    }

    return supabaseResponse;
  } catch (error) {
    // If Supabase call fails, don't crash — just pass through
    console.error("Middleware error:", error);
    return NextResponse.next({ request });
  }
}

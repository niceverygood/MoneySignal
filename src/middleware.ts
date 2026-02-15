import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match paths that need auth processing:
     * - /app/* (subscriber area)
     * - /partner/* (partner area)
     * - /admin/* (admin area)
     * Exclude static files, images, API routes, auth routes, and public routes.
     */
    "/app/:path*",
    "/partner/:path*",
    "/admin/:path*",
  ],
};

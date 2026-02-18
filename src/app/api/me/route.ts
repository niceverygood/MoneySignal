import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch profile using server-side client (bypasses client RLS issues)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "사용자",
      role: "user",
      subscription_tier: "free",
      avatar_url: user.user_metadata?.avatar_url || null,
      subscription_expires_at: null,
      referred_by: null,
      created_at: user.created_at,
      updated_at: user.created_at,
    });
  }

  return NextResponse.json(profile);
}

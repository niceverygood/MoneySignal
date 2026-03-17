import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("verdicts")
    .select("*")
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch verdict" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ verdict: null, date });
  }

  return NextResponse.json({ verdict: data, date });
}

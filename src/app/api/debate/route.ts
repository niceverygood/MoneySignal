export const maxDuration = 120;

import { NextResponse } from "next/server";
import { generateDebate } from "@/lib/debate";

export async function GET(request: Request) {
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

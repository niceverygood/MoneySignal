import { NextResponse } from "next/server";
import { calculateMarketSentiment } from "@/lib/market-sentiment";

// 5분 캐시 (ISR)
export const revalidate = 300;

export async function GET() {
  try {
    const sentiment = await calculateMarketSentiment();
    return NextResponse.json(sentiment);
  } catch (error) {
    console.error("Market sentiment error:", error);
    return NextResponse.json(
      { error: "Failed to calculate market sentiment" },
      { status: 500 }
    );
  }
}

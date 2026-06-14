"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMarketLevel } from "@/lib/market-sentiment";
import type { SentimentResult } from "@/lib/market-sentiment";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function MarketSentimentGauge() {
  const [data, setData] = useState<SentimentResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market/sentiment")
      .then((res) => res.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-4 flex items-center justify-center h-[180px]">
        <Loader2 className="w-5 h-5 text-[#F5B800] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const level = getMarketLevel(data.compositeScore);

  // 반원 게이지: 0점 = 180도(왼쪽), 100점 = 0도(오른쪽)
  const needleRad = Math.PI - (data.compositeScore / 100) * Math.PI;

  // 한 줄 해석 (참고용 시장 상태 설명 — 매매 지시 아님)
  const LEVEL_HINT: Record<string, string> = {
    extreme_fear: "시장에 극도의 공포 — 과매도 구간일 수 있어요",
    fear: "시장에 공포가 큽니다 — 변동성에 주의하세요",
    caution: "투자 심리가 위축돼 있어요",
    neutral: "시장 심리는 중립이에요",
    optimistic: "투자 심리가 살아나고 있어요",
    greed: "시장에 탐욕이 큽니다 — 과열을 주의하세요",
    extreme_greed: "극도의 탐욕 — 과열을 주의하세요",
  };
  const hint = LEVEL_HINT[level.level] ?? "";

  return (
    <div className="rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">시장 심리 지수</h3>
        <span className="text-[10px] text-[#8B95A5]">
          5분마다 갱신
        </span>
      </div>

      {/* Gauge + Score */}
      <div className="flex items-center gap-4">
        {/* Semi-circle gauge */}
        <div className="relative w-[120px] h-[65px] flex-shrink-0">
          <svg viewBox="0 0 120 65" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke="#2A2D36"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Gradient segments */}
            <path d="M 10 60 A 50 50 0 0 1 28 22" fill="none" stroke="#8B0000" strokeWidth="8" strokeLinecap="round" />
            <path d="M 28 22 A 50 50 0 0 1 42 13" fill="none" stroke="#FF5252" strokeWidth="8" />
            <path d="M 42 13 A 50 50 0 0 1 52 11" fill="none" stroke="#FF9800" strokeWidth="8" />
            <path d="M 52 11 A 50 50 0 0 1 68 11" fill="none" stroke="#FFD600" strokeWidth="8" />
            <path d="M 68 11 A 50 50 0 0 1 78 13" fill="none" stroke="#66BB6A" strokeWidth="8" />
            <path d="M 78 13 A 50 50 0 0 1 92 22" fill="none" stroke="#43A047" strokeWidth="8" />
            <path d="M 92 22 A 50 50 0 0 1 110 60" fill="none" stroke="#1B5E20" strokeWidth="8" strokeLinecap="round" />
            {/* Needle */}
            <line
              x1="60"
              y1="60"
              x2={60 + 38 * Math.cos(needleRad)}
              y2={60 - 38 * Math.sin(needleRad)}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="60" cy="60" r="3" fill="white" />
          </svg>
        </div>

        {/* Score + Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data.compositeScore}</span>
            <span className="text-xs" style={{ color: level.color }}>/ 100</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-lg">{level.emoji}</span>
            <span className="text-sm font-bold" style={{ color: level.color }}>
              {level.label}
            </span>
          </div>
          <p className="text-[11px] text-[#8B95A5] mt-1.5 leading-snug">{hint}</p>
        </div>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-3 gap-2">
        {data.indicators.map((ind) => (
          <div
            key={ind.name}
            className="rounded-lg bg-[#0D0F14] px-2.5 py-2 text-center"
          >
            <p className="text-[10px] text-[#8B95A5] truncate">{ind.name}</p>
            <p className="text-xs font-mono text-white mt-0.5">
              {ind.name === "VIX"
                ? ind.value.toFixed(1)
                : ind.name === "USD/KRW"
                  ? ind.value.toFixed(0)
                  : ind.value >= 1000
                    ? ind.value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
                    : ind.value.toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              {ind.change > 0 ? (
                <TrendingUp className="w-2.5 h-2.5 text-[#00E676]" />
              ) : ind.change < 0 ? (
                <TrendingDown className="w-2.5 h-2.5 text-[#FF5252]" />
              ) : (
                <Minus className="w-2.5 h-2.5 text-[#8B95A5]" />
              )}
              <span
                className={cn(
                  "text-[10px] font-mono",
                  ind.change > 0 ? "text-[#00E676]" : ind.change < 0 ? "text-[#FF5252]" : "text-[#8B95A5]"
                )}
              >
                {ind.change >= 0 ? "+" : ""}{ind.change.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

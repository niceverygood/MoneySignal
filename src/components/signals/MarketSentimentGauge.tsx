"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMarketLevel, getInvestmentVerdict } from "@/lib/market-sentiment";
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

  // 예시 가중 매수 점수 (confidence 5점 기준)
  const exampleWeighted = 5 * data.buyWeight;
  const verdict = getInvestmentVerdict(exampleWeighted);

  return (
    <div className="rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">시장 타이밍 시그널</h3>
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
          <p className="text-[10px] text-[#8B95A5] mt-1">
            매수 가중치: <span className="text-white font-mono">{(data.buyWeight * 100).toFixed(0)}%</span>
            <span className="mx-1">·</span>
            매도 가중치: <span className="text-white font-mono">{(data.sellWeight * 100).toFixed(0)}%</span>
          </p>
        </div>
      </div>

      {/* Investment verdict example */}
      <div
        className="rounded-lg px-3 py-2 text-center"
        style={{ backgroundColor: verdict.bgColor }}
      >
        <p className="text-[10px] text-[#8B95A5] mb-0.5">AI 최고점수(5점) 종목 기준</p>
        <p className="text-sm font-bold" style={{ color: verdict.color }}>
          {verdict.emoji} {verdict.label}
          <span className="text-[#8B95A5] font-normal text-xs ml-2">
            (가중 매수 점수: {exampleWeighted.toFixed(1)})
          </span>
        </p>
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

      {/* Verdict scale */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-[#8B95A5]">투자 판정 기준</p>
        <div className="flex gap-1">
          {[
            { label: "적극 매수", score: "3.5+", color: "#00E676" },
            { label: "분할 매수", score: "2.5~3.4", color: "#448AFF" },
            { label: "관망", score: "1.5~2.4", color: "#FFD600" },
            { label: "매수 금지", score: "<1.5", color: "#FF5252" },
          ].map((v) => (
            <div
              key={v.label}
              className="flex-1 rounded px-1.5 py-1 text-center"
              style={{ backgroundColor: `${v.color}10` }}
            >
              <p className="text-[9px] font-bold" style={{ color: v.color }}>{v.label}</p>
              <p className="text-[8px] text-[#8B95A5]">{v.score}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

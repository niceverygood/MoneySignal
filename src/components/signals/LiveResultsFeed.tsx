"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LiveResult {
  symbol_name: string;
  direction: string;
  result_pnl_percent: number;
  status: string;
}

interface LiveResultsFeedProps {
  results: LiveResult[];
}

export default function LiveResultsFeed({ results }: LiveResultsFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (results.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % results.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [results.length]);

  if (results.length === 0) return null;

  const current = results[currentIndex];
  const isProfit = current.result_pnl_percent > 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1A1D26] border border-[#2A2D36] overflow-hidden">
      <div className={cn(
        "w-2 h-2 rounded-full shrink-0",
        isProfit ? "bg-[#00E676] animate-pulse" : "bg-[#FF5252]"
      )} />
      <div className="flex items-center gap-2 text-xs animate-slide-in overflow-hidden" key={currentIndex}>
        <span className="text-white font-medium whitespace-nowrap">{current.symbol_name}</span>
        <span className={cn(
          "font-bold text-[10px] px-1.5 py-0.5 rounded",
          current.direction === "long" || current.direction === "buy"
            ? "bg-[#00E676]/10 text-[#00E676]"
            : "bg-[#FF5252]/10 text-[#FF5252]"
        )}>
          {current.direction === "long" || current.direction === "buy" ? "LONG" : "SHORT"}
        </span>
        <span className={cn(
          "font-bold font-mono whitespace-nowrap",
          isProfit ? "text-[#00E676]" : "text-[#FF5252]"
        )}>
          {isProfit ? "+" : ""}{current.result_pnl_percent.toFixed(1)}%
        </span>
        <span>{isProfit ? "✅" : "❌"}</span>
        <span className="text-[#8B95A5] text-[10px] whitespace-nowrap">
          {current.status === "hit_tp1" ? "TP1 도달" :
           current.status === "hit_tp2" ? "TP2 도달" :
           current.status === "hit_tp3" ? "TP3 도달" :
           current.status === "hit_sl" ? "손절" : current.status}
        </span>
      </div>
      <span className="text-[#F5B800] text-[10px] ml-auto shrink-0">LIVE</span>
    </div>
  );
}

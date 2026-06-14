"use client";

// ============================================
// AI 적중률 배지 — '검증되는 AI'(anti-리딩방) 신뢰 장치. 홈 평결카드·일일평결카드 공용.
// /api/verdict/accuracy 자체 조회. 집계 전이면 '집계 중' 폴백(절대 빈 화면 안 됨).
// ============================================
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AccuracyStat {
  count: number;
  hitRate: number;
  avgReturn: number;
}

export default function AccuracyBadge({ className }: { className?: string }) {
  const [acc, setAcc] = useState<{ d7: AccuracyStat | null; d30: AccuracyStat | null } | null>(null);

  useEffect(() => {
    fetch("/api/verdict/accuracy")
      .then((r) => r.json())
      .then((d) => setAcc({ d7: d.d7 ?? null, d30: d.d30 ?? null }))
      .catch(() => {});
  }, []);

  const best = acc?.d30?.count ? acc.d30 : acc?.d7?.count ? acc.d7 : null;
  const horizon = acc?.d30?.count ? "30일" : "7일";

  if (!best) {
    return (
      <div className={cn("flex items-center gap-1.5 rounded-lg bg-[#0D0F14] px-2.5 py-1.5", className)}>
        <span className="text-[10px] text-[#8B95A5]">
          📊 검증 집계 중 — 모든 평결은 발행가와 함께 서버에 기록됩니다
        </span>
      </div>
    );
  }

  const positive = best.avgReturn >= 0;
  return (
    <div className={cn("flex items-center justify-between rounded-lg bg-[#0D0F14] px-2.5 py-1.5", className)}>
      <span className="text-[10px] text-[#8B95A5]">최근 {horizon} 매수의견 적중률</span>
      <span className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-[#F5B800]">{best.hitRate}%</span>
        <span
          className={cn("text-[10px] font-bold font-mono", positive ? "text-[#00E676]" : "text-[#FF5252]")}
        >
          평균 {positive ? "+" : ""}{best.avgReturn}%
        </span>
        <span className="text-[9px] text-[#8B95A5]/60">({best.count}종목)</span>
      </span>
    </div>
  );
}

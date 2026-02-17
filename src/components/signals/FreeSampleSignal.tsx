"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Star, Lock, TrendingUp, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { FilteredSignal, TierKey } from "@/lib/tier-access";

interface FreeSampleSignalProps {
  signal: FilteredSignal | null;
  tier: TierKey;
}

export default function FreeSampleSignal({ signal, tier }: FreeSampleSignalProps) {
  const [revealed, setRevealed] = useState(false);

  // Only show for free users, and only if there's a completed profitable signal
  if (tier !== "free" || !signal) return null;

  const pnl = Number(signal.result_pnl_percent || 0);
  if (pnl <= 0) return null;

  return (
    <Card className="bg-[#1A1D26] border-[#F5B800]/20 p-4 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-4 h-4 text-[#F5B800]" />
        <span className="text-xs text-[#F5B800] font-bold">무료 체험 시그널</span>
        <Badge className="bg-[#00E676]/10 text-[#00E676] border-0 text-[10px] ml-auto">
          결과 공개
        </Badge>
      </div>

      {/* Signal info - always visible */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{signal.symbol}</span>
          <Badge className={cn(
            "text-[10px] border-0",
            signal.direction === "long" || signal.direction === "buy"
              ? "bg-[#00E676]/10 text-[#00E676]"
              : "bg-[#FF5252]/10 text-[#FF5252]"
          )}>
            {signal.direction.toUpperCase()}
          </Badge>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn("w-3 h-3", i < signal.confidence ? "fill-[#F5B800] text-[#F5B800]" : "text-[#2A2D36]")} />
          ))}
        </div>
      </div>

      {/* Result - always visible */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl font-bold text-[#00E676] font-mono">
          +{pnl.toFixed(1)}%
        </span>
        <Badge className="bg-[#00E676]/10 text-[#00E676] border-0">
          {signal.status === "hit_tp1" ? "TP1 도달" :
           signal.status === "hit_tp2" ? "TP2 도달" :
           signal.status === "hit_tp3" ? "TP3 도달" : signal.status}
        </Badge>
      </div>

      {/* Reveal button or details */}
      {!revealed ? (
        <Button
          onClick={() => setRevealed(true)}
          variant="outline"
          className="w-full border-[#F5B800]/30 text-[#F5B800] hover:bg-[#F5B800]/10"
        >
          <Eye className="w-4 h-4 mr-2" />
          무료로 상세 분석 보기
        </Button>
      ) : (
        <div className="space-y-2 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-xs text-[#8B95A5] mb-2">
            {signal.ai_reasoning
              ? signal.ai_reasoning.replace(/##?\s/g, "").replace(/\*\*/g, "").replace(/###?\s/g, "").replace(/\n/g, " ").substring(0, 200)
              : "AI 분석 근거를 확인하려면 구독이 필요합니다."}
          </p>

          <div className="p-3 rounded-lg bg-[#F5B800]/5 border border-[#F5B800]/20 text-center">
            <p className="text-xs text-[#F5B800] mb-2">
              이런 시그널을 실시간으로 받아보세요
            </p>
            <Link href="/app/subscribe">
              <Button size="sm" className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-bold">
                구독 시작하기 →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

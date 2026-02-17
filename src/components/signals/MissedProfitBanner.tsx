"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Flame, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { TierKey } from "@/lib/tier-access";

interface MissedProfitBannerProps {
  tier: TierKey;
  completedSignals: Array<{
    symbol_name: string;
    result_pnl_percent: number | null;
    status: string;
    direction: string;
  }>;
}

export default function MissedProfitBanner({ tier, completedSignals }: MissedProfitBannerProps) {
  const [animatedProfit, setAnimatedProfit] = useState(0);

  // Calculate total missed profit from completed signals
  const profitableSignals = completedSignals.filter(
    (s) => s.result_pnl_percent && Number(s.result_pnl_percent) > 0
  );
  const totalProfit = profitableSignals.reduce(
    (sum, s) => sum + Number(s.result_pnl_percent || 0),
    0
  );
  const winCount = profitableSignals.length;
  const totalCount = completedSignals.filter((s) => s.status !== "active").length;
  const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;

  // Animate the profit counter
  useEffect(() => {
    if (totalProfit <= 0) return;
    let current = 0;
    const step = totalProfit / 40;
    const timer = setInterval(() => {
      current += step;
      if (current >= totalProfit) {
        current = totalProfit;
        clearInterval(timer);
      }
      setAnimatedProfit(current);
    }, 50);
    return () => clearInterval(timer);
  }, [totalProfit]);

  // Only show for free/basic users
  if (tier !== "free" && tier !== "basic") return null;
  if (completedSignals.length === 0) return null;

  // Calculate simulated money (if invested 100만원)
  const simulatedInvestment = 1000000;
  const simulatedProfit = Math.round((simulatedInvestment * totalProfit) / 100);

  return (
    <Card className="bg-gradient-to-r from-[#FF5252]/5 via-[#F5B800]/10 to-[#00E676]/5 border-[#F5B800]/30 p-4 relative overflow-hidden">
      {/* Animated fire background */}
      <div className="absolute top-0 right-0 opacity-10">
        <Flame className="w-24 h-24 text-[#F5B800]" />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-[#F5B800]" />
          <p className="text-xs text-[#F5B800] font-bold uppercase tracking-wider">
            당신이 놓친 수익
          </p>
        </div>

        {/* Big profit number */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold text-[#00E676] font-mono">
            +{animatedProfit.toFixed(1)}%
          </span>
          <span className="text-sm text-[#8B95A5]">누적 수익률</span>
        </div>

        {/* Simulated money */}
        <p className="text-sm text-[#8B95A5] mb-3">
          100만원 투자 시{" "}
          <span className="text-[#00E676] font-bold font-mono">
            +{simulatedProfit.toLocaleString()}원
          </span>{" "}
          수익
        </p>

        {/* Stats row */}
        <div className="flex gap-4 mb-3 text-xs">
          <div>
            <span className="text-[#8B95A5]">성공 시그널</span>
            <span className="text-[#00E676] font-bold ml-1">{winCount}건</span>
          </div>
          <div>
            <span className="text-[#8B95A5]">승률</span>
            <span className="text-[#F5B800] font-bold ml-1">{winRate.toFixed(0)}%</span>
          </div>
          <div>
            <span className="text-[#8B95A5]">총 시그널</span>
            <span className="text-white font-bold ml-1">{totalCount}건</span>
          </div>
        </div>

        {/* Recent profitable signals */}
        <div className="space-y-1 mb-3">
          {profitableSignals.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-[#0D0F14]/40 rounded px-2 py-1">
              <span className="text-white">{s.symbol_name}</span>
              <span className={cn(
                "font-mono font-bold",
                s.direction === "long" || s.direction === "buy" ? "text-[#00E676]" : "text-[#FF5252]"
              )}>
                {s.direction === "long" || s.direction === "buy" ? "LONG" : "SHORT"}
              </span>
              <span className="text-[#00E676] font-bold font-mono">
                +{Number(s.result_pnl_percent).toFixed(1)}%
              </span>
              <span>✅</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link href="/app/subscribe">
          <Button className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-bold h-10">
            <Lock className="w-4 h-4 mr-2" />
            지금 구독하고 다음 시그널 받기
          </Button>
        </Link>
        <p className="text-[10px] text-[#8B95A5] text-center mt-2">
          매 4시간마다 새 시그널 발행 · 언제든 해지 가능
        </p>
      </div>
    </Card>
  );
}

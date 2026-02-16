"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { BacktestResult } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import dayjs from "dayjs";

export default function AdminBacktestPage() {
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchResults = async () => {
    const { data } = await supabase
      .from("backtest_results")
      .select("*")
      .order("generated_at", { ascending: false });

    if (data) setResults(data as BacktestResult[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const triggerRecalc = async () => {
    try {
      const res = await fetch(
        `/api/cron/calculate-backtest?secret=${process.env.NEXT_PUBLIC_CRON_SECRET || "dev"}`
      );
      if (res.ok) {
        toast.success("백테스트 재계산이 시작되었습니다");
        setTimeout(fetchResults, 3000);
      }
    } catch {
      toast.error("요청에 실패했습니다");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">백테스트 관리</h1>
        <Button
          onClick={triggerRecalc}
          className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          재계산
        </Button>
      </div>

      <div className="grid gap-4">
        {results.map((result) => (
          <Card key={result.id} className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-[#2A2D36] text-[#8B95A5]">
                  {CATEGORY_LABELS[result.category as keyof typeof CATEGORY_LABELS] || result.category}
                </Badge>
                <span className="text-xs text-[#8B95A5]">
                  {result.period_start} ~ {result.period_end}
                </span>
              </div>
              <span className="text-[10px] text-[#8B95A5]">
                생성: {dayjs(result.generated_at).format("MM.DD HH:mm")}
              </span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3 text-center">
              <div>
                <p className="text-[10px] text-[#8B95A5]">시그널</p>
                <p className="text-sm font-bold text-white">{result.total_signals}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8B95A5]">승률</p>
                <p className="text-sm font-bold text-[#F5B800]">
                  {Number(result.win_rate).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#8B95A5]">평균수익</p>
                <p className="text-sm font-bold text-[#00E676]">
                  +{Number(result.avg_profit_percent).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#8B95A5]">평균손실</p>
                <p className="text-sm font-bold text-[#FF5252]">
                  {Number(result.avg_loss_percent).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#8B95A5]">누적</p>
                <p className="text-sm font-bold text-[#00E676]">
                  +{Number(result.total_pnl_percent).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#8B95A5]">MDD</p>
                <p className="text-sm font-bold text-[#FF5252]">
                  {Number(result.max_drawdown_percent).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#8B95A5]">손익비</p>
                <p className="text-sm font-bold text-white">
                  {Number(result.profit_factor).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        ))}

        {results.length === 0 && (
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-8 text-center">
            <p className="text-[#8B95A5]">백테스트 결과가 없습니다</p>
          </Card>
        )}
      </div>
    </div>
  );
}

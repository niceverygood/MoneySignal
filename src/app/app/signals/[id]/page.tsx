"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Star, Clock, Brain, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Signal, SignalTracking } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

export default function SignalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [signal, setSignal] = useState<Signal | null>(null);
  const [tracking, setTracking] = useState<SignalTracking[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchSignal() {
      const { data } = await supabase
        .from("signals")
        .select("*")
        .eq("id", params.id)
        .single();

      if (data) setSignal(data as Signal);

      // Fetch tracking data
      const { data: trackingData } = await supabase
        .from("signal_tracking")
        .select("*")
        .eq("signal_id", params.id)
        .order("checked_at", { ascending: false })
        .limit(50);

      if (trackingData) setTracking(trackingData as SignalTracking[]);

      setLoading(false);
    }

    fetchSignal();
  }, [params.id, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="text-center py-20">
        <p className="text-[#8B95A5]">시그널을 찾을 수 없습니다</p>
      </div>
    );
  }

  const isLong = signal.direction === "long" || signal.direction === "buy";
  const entryPrice = Number(signal.entry_price);

  return (
    <div className="py-4 space-y-4">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="text-[#8B95A5] hover:text-white -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        뒤로
      </Button>

      {/* Signal Header */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                signal.status === "active"
                  ? "bg-[#00E676] signal-active"
                  : "bg-[#8B95A5]"
              )}
            />
            <div>
              <h1 className="text-xl font-bold text-white">
                {signal.symbol_name}
              </h1>
              <p className="text-sm text-[#8B95A5]">{signal.symbol}</p>
            </div>
          </div>
          <Badge
            className={cn(
              "text-sm border-0 font-bold px-3 py-1",
              isLong
                ? "bg-[#00E676]/10 text-[#00E676]"
                : "bg-[#FF5252]/10 text-[#FF5252]"
            )}
          >
            {signal.direction.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-[#8B95A5]">
          <span>{CATEGORY_LABELS[signal.category]}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {signal.timeframe}
          </span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-3.5 h-3.5",
                  i < signal.confidence
                    ? "fill-[#F5B800] text-[#F5B800]"
                    : "text-[#2A2D36]"
                )}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Price Levels */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#8B95A5] uppercase tracking-wider">
          가격 레벨
        </h2>

        <div className="space-y-2">
          <PriceRow label="진입가" value={entryPrice} color="text-white" />
          {signal.stop_loss && (
            <PriceRow
              label="손절"
              value={Number(signal.stop_loss)}
              pnl={((Number(signal.stop_loss) - entryPrice) / entryPrice) * 100}
              color="text-[#FF5252]"
            />
          )}
          {signal.take_profit_1 && (
            <PriceRow
              label="1차 익절"
              value={Number(signal.take_profit_1)}
              pnl={
                ((Number(signal.take_profit_1) - entryPrice) / entryPrice) * 100
              }
              color="text-[#00E676]"
            />
          )}
          {signal.take_profit_2 && (
            <PriceRow
              label="2차 익절"
              value={Number(signal.take_profit_2)}
              pnl={
                ((Number(signal.take_profit_2) - entryPrice) / entryPrice) * 100
              }
              color="text-[#00E676]"
            />
          )}
          {signal.take_profit_3 && (
            <PriceRow
              label="3차 익절"
              value={Number(signal.take_profit_3)}
              pnl={
                ((Number(signal.take_profit_3) - entryPrice) / entryPrice) * 100
              }
              color="text-[#00E676]"
            />
          )}
        </div>

        {(signal.leverage_conservative || signal.leverage_aggressive) && (
          <div className="pt-2 border-t border-[#2A2D36]">
            <div className="flex justify-between text-sm">
              <span className="text-[#8B95A5]">레버리지</span>
              <span className="text-white font-mono">
                보수적 {signal.leverage_conservative}x · 공격적{" "}
                {signal.leverage_aggressive}x
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* AI Reasoning */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-[#F5B800]" />
          <h2 className="text-sm font-semibold text-[#8B95A5] uppercase tracking-wider">
            AI 분석 근거
          </h2>
        </div>
        <p className="text-sm text-[#8B95A5] leading-relaxed whitespace-pre-wrap">
          {signal.ai_reasoning}
        </p>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2A2D36]">
          {signal.ai_models_used.map((model) => (
            <Badge
              key={model}
              variant="outline"
              className="text-[10px] border-[#2A2D36] text-[#8B95A5]"
            >
              {model}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Result (if closed) */}
      {signal.status !== "active" && (
        <Card
          className={cn(
            "border-[#2A2D36] p-4",
            signal.result_pnl_percent && Number(signal.result_pnl_percent) >= 0
              ? "bg-[#00E676]/5"
              : "bg-[#FF5252]/5"
          )}
        >
          <h2 className="text-sm font-semibold text-[#8B95A5] mb-2">결과</h2>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">
              {signal.result_pnl_percent && Number(signal.result_pnl_percent) >= 0
                ? "+"
                : ""}
              {Number(signal.result_pnl_percent || 0).toFixed(2)}%
            </span>
            <Badge
              className={cn(
                "border-0",
                signal.status.startsWith("hit_tp")
                  ? "bg-[#00E676]/10 text-[#00E676]"
                  : "bg-[#FF5252]/10 text-[#FF5252]"
              )}
            >
              {signal.status === "hit_tp1" && "1차 익절 도달"}
              {signal.status === "hit_tp2" && "2차 익절 도달"}
              {signal.status === "hit_tp3" && "3차 익절 도달"}
              {signal.status === "hit_sl" && "손절 도달"}
              {signal.status === "expired" && "만료"}
            </Badge>
          </div>
          {signal.closed_at && (
            <p className="text-xs text-[#8B95A5] mt-1">
              {dayjs(signal.closed_at).format("YYYY.MM.DD HH:mm")} 종료
            </p>
          )}
        </Card>
      )}

      {/* Tracking History */}
      {tracking.length > 0 && (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <h2 className="text-sm font-semibold text-[#8B95A5] mb-3 uppercase tracking-wider">
            가격 추적 로그
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tracking.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-[#8B95A5]">
                  {dayjs(t.checked_at).format("MM/DD HH:mm")}
                </span>
                <span className="text-white font-mono">
                  {Number(t.current_price).toLocaleString()}
                </span>
                <span
                  className={cn(
                    "font-mono",
                    Number(t.pnl_percent) >= 0
                      ? "text-[#00E676]"
                      : "text-[#FF5252]"
                  )}
                >
                  {Number(t.pnl_percent) >= 0 ? "+" : ""}
                  {Number(t.pnl_percent).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transparency notice */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <Shield className="w-4 h-4 text-[#F5B800] shrink-0" />
        <p className="text-[10px] text-[#8B95A5] leading-relaxed">
          모든 시그널은 서버 타임스탬프로 기록되어 사후 수정이 불가능합니다.
          발행 시점의 실제 시장가를 기준으로 수익률이 계산됩니다.
        </p>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  value,
  pnl,
  color,
}: {
  label: string;
  value: number;
  pnl?: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#8B95A5]">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("font-mono", color)}>
          {value >= 1000
            ? value.toLocaleString("ko-KR")
            : value >= 1
              ? value.toFixed(2)
              : value.toFixed(4)}
        </span>
        {pnl !== undefined && (
          <span
            className={cn(
              "text-xs font-mono",
              pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
            )}
          >
            ({pnl >= 0 ? "+" : ""}
            {pnl.toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  );
}

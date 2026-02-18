"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Star, Clock, Brain, Shield, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Signal, SignalTracking } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { filterSignalByTier, TIER_CONFIG } from "@/lib/tier-access";
import type { TierKey, FilteredSignal } from "@/lib/tier-access";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

export default function SignalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [signal, setSignal] = useState<FilteredSignal | null>(null);
  const [rawSignal, setRawSignal] = useState<Signal | null>(null);
  const [tracking, setTracking] = useState<SignalTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<TierKey>("free");

  const supabase = createClient();

  useEffect(() => {
    async function fetchSignal() {
      // Get user tier
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();
        if (profile) setUserTier((profile.subscription_tier || "free") as TierKey);
      }

      const { data } = await supabase
        .from("signals")
        .select("*")
        .eq("id", params.id)
        .single();

      if (data) {
        const raw = data as Signal;
        setRawSignal(raw);
        // Apply tier filter
        const tier = userTier;
        setSignal(filterSignalByTier(raw, tier));
      }

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
  }, [params.id, supabase, userTier]);

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
          <span>{(CATEGORY_LABELS as Record<string, string>)[signal.category] || signal.category}</span>
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

      {/* Price Levels (tier-filtered) */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#8B95A5] uppercase tracking-wider">
          가격 레벨
        </h2>

        <div className="space-y-2">
          {signal.entry_price ? (
            <PriceRow label="진입가" value={signal.entry_price} color="text-white" />
          ) : (
            <LockedRow label="진입가" unlockTier="Basic" />
          )}

          {signal.stop_loss ? (
            <PriceRow
              label="손절"
              value={signal.stop_loss}
              pnl={signal.entry_price ? ((signal.stop_loss - signal.entry_price) / signal.entry_price) * 100 : undefined}
              color="text-[#FF5252]"
            />
          ) : signal._tier_info.lockedFields.includes("stop_loss") ? (
            <LockedRow label="손절" unlockTier="Basic" />
          ) : null}

          {signal.take_profit_1 ? (
            <PriceRow
              label="1차 익절"
              value={signal.take_profit_1}
              pnl={signal.entry_price ? ((signal.take_profit_1 - signal.entry_price) / signal.entry_price) * 100 : undefined}
              color="text-[#00E676]"
            />
          ) : (
            <LockedRow label="1차 익절" unlockTier="Basic" />
          )}

          {signal.take_profit_2 ? (
            <PriceRow
              label="2차 익절"
              value={signal.take_profit_2}
              pnl={signal.entry_price ? ((signal.take_profit_2 - signal.entry_price) / signal.entry_price) * 100 : undefined}
              color="text-[#00E676]"
            />
          ) : (
            <LockedRow label="2차 익절" unlockTier="Pro" />
          )}

          {signal.take_profit_3 ? (
            <PriceRow
              label="3차 익절"
              value={signal.take_profit_3}
              pnl={signal.entry_price ? ((signal.take_profit_3 - signal.entry_price) / signal.entry_price) * 100 : undefined}
              color="text-[#00E676]"
            />
          ) : (
            <LockedRow label="3차 익절" unlockTier="Premium" />
          )}
        </div>

        {/* Leverage */}
        {signal.leverage_conservative || signal.leverage_aggressive ? (
          <div className="pt-2 border-t border-[#2A2D36]">
            <div className="flex justify-between text-sm">
              <span className="text-[#8B95A5]">레버리지</span>
              <span className="text-white font-mono">
                {signal.leverage_conservative ? `보수적 ${signal.leverage_conservative}x` : ""}
                {signal.leverage_aggressive ? ` · 공격적 ${signal.leverage_aggressive}x` : ""}
              </span>
            </div>
          </div>
        ) : signal._tier_info.lockedFields.includes("leverage_conservative") ? (
          <div className="pt-2 border-t border-[#2A2D36]">
            <LockedRow label="레버리지" unlockTier="Pro" />
          </div>
        ) : null}
      </Card>

      {/* AI Reasoning (tier-filtered) */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-[#F5B800]" />
          <h2 className="text-sm font-semibold text-white">
            AI 분석 근거
          </h2>
          <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-[10px] ml-auto">
            Claude Opus 4.6
          </Badge>
        </div>

        {!signal.ai_reasoning ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Lock className="w-8 h-8 text-[#F5B800]/50" />
            <p className="text-sm text-[#8B95A5] text-center">
              AI 분석 근거는 <span className="text-[#F5B800] font-bold">Basic</span> 이상에서 확인 가능합니다
            </p>
            <a href="/app/subscribe" className="px-4 py-2 bg-[#F5B800] text-[#0D0F14] rounded-lg text-xs font-bold hover:bg-[#FFD54F]">
              구독하고 AI 분석 보기
            </a>
          </div>
        ) : (
        <>
        <div className="ai-reasoning text-sm text-[#8B95A5] leading-relaxed space-y-2">
          {signal.ai_reasoning.split("\n").map((line, i) => {
            if (!line.trim()) return null;
            // H2 headers
            if (line.startsWith("## ")) {
              return <h3 key={i} className="text-white font-bold mt-3 mb-1 text-base">{line.replace("## ", "")}</h3>;
            }
            // H3 headers
            if (line.startsWith("### ")) {
              return <h4 key={i} className="text-[#F5B800] font-semibold mt-2 mb-1 text-sm">{line.replace("### ", "")}</h4>;
            }
            // Bold text
            if (line.startsWith("**") && line.endsWith("**")) {
              return <p key={i} className="text-white font-semibold">{line.replace(/\*\*/g, "")}</p>;
            }
            // List items
            if (line.startsWith("- ")) {
              const text = line.substring(2);
              // Parse inline bold
              const parts = text.split(/\*\*(.*?)\*\*/);
              return (
                <div key={i} className="flex gap-2 pl-2">
                  <span className="text-[#F5B800] mt-0.5">•</span>
                  <span>
                    {parts.map((part, j) =>
                      j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part
                    )}
                  </span>
                </div>
              );
            }
            // Regular paragraph with bold parsing
            const parts = line.split(/\*\*(.*?)\*\*/);
            return (
              <p key={i}>
                {parts.map((part, j) =>
                  j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part
                )}
              </p>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#2A2D36]">
          <span className="text-[10px] text-[#8B95A5]">분석 모델:</span>
          {signal.ai_models_used.map((model) => (
            <Badge
              key={model}
              variant="outline"
              className="text-[10px] border-[#F5B800]/20 text-[#F5B800]"
            >
              {model}
            </Badge>
          ))}
          <span className="text-[10px] text-[#8B95A5] ml-auto">
            {dayjs(signal.created_at).format("YYYY.MM.DD HH:mm")} 분석
          </span>
        </div>
        </>
        )}
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

function LockedRow({ label, unlockTier }: { label: string; unlockTier: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#8B95A5]">{label}</span>
      <span className="text-[#8B95A5]/40 text-xs flex items-center gap-1">
        <Lock className="w-3 h-3" />
        {unlockTier} 이상
      </span>
    </div>
  );
}

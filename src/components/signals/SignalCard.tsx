"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Lock, Star, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Signal, SubscriptionTier, SignalWithPrice } from "@/types";
import { CATEGORY_LABELS, TIER_ACCESS } from "@/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";
import Link from "next/link";

dayjs.extend(relativeTime);
dayjs.locale("ko");

interface SignalCardProps {
  signal: SignalWithPrice;
  userTier: SubscriptionTier;
  currentPrice?: number;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("ko-KR");
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

function getTimeRemaining(validUntil: string): string {
  const diff = dayjs(validUntil).diff(dayjs(), "minute");
  if (diff <= 0) return "만료됨";
  if (diff < 60) return `${diff}분 남음`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hours}h ${mins}m 남음`;
}

export default function SignalCard({
  signal,
  userTier,
  currentPrice,
}: SignalCardProps) {
  const isLong = signal.direction === "long" || signal.direction === "buy";
  const canAccess = checkAccess(userTier, signal.min_tier_required as SubscriptionTier);
  const isCompleted = signal.status !== "active";

  // Calculate PnL
  const entryPrice = Number(signal.entry_price);
  const price = currentPrice || signal.current_price;
  let pnlPercent = signal.current_pnl_percent || 0;
  if (price && !isCompleted) {
    pnlPercent = isLong
      ? ((price - entryPrice) / entryPrice) * 100
      : ((entryPrice - price) / entryPrice) * 100;
  }
  if (isCompleted && signal.result_pnl_percent != null) {
    pnlPercent = Number(signal.result_pnl_percent);
  }

  // Calculate TP1 progress
  let tp1Progress = 0;
  if (price && signal.take_profit_1 && !isCompleted) {
    const tp1 = Number(signal.take_profit_1);
    if (isLong) {
      tp1Progress = Math.min(
        100,
        Math.max(0, ((price - entryPrice) / (tp1 - entryPrice)) * 100)
      );
    } else {
      tp1Progress = Math.min(
        100,
        Math.max(0, ((entryPrice - price) / (entryPrice - tp1)) * 100)
      );
    }
  }

  const statusLabel = getStatusLabel(signal.status);
  const statusColor = getStatusColor(signal.status);

  return (
    <Link href={`/app/signals/${signal.id}`}>
      <div
        className={cn(
          "rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-4 transition-all hover:border-[#3A3D46]",
          signal.status === "active" && "hover:shadow-[0_0_20px_rgba(245,184,0,0.05)]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                signal.status === "active" ? "bg-[#00E676] signal-active" : "bg-[#8B95A5]"
              )}
            />
            <span className="font-bold text-white text-sm">
              {signal.symbol.replace("USDT", "/USDT")}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 border-0 font-bold",
                isLong
                  ? "bg-[#00E676]/10 text-[#00E676]"
                  : "bg-[#FF5252]/10 text-[#FF5252]"
              )}
            >
              {isLong ? (
                <TrendingUp className="w-3 h-3 mr-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-0.5" />
              )}
              {signal.direction.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-3 h-3",
                  i < signal.confidence
                    ? "fill-[#F5B800] text-[#F5B800]"
                    : "text-[#2A2D36]"
                )}
              />
            ))}
          </div>
        </div>

        {/* Category & Time */}
        <div className="flex items-center gap-2 text-[11px] text-[#8B95A5] mb-3">
          <span>{CATEGORY_LABELS[signal.category] || signal.category}</span>
          <span>·</span>
          <span>{dayjs(signal.created_at).fromNow()}</span>
          {signal.status === "active" && (
            <>
              <span>·</span>
              <span className="text-[#F5B800]">
                {getTimeRemaining(signal.valid_until)}
              </span>
            </>
          )}
        </div>

        {/* Price Data */}
        <div
          className={cn(
            "space-y-1.5 text-sm",
            !canAccess && !isCompleted && "signal-blur"
          )}
        >
          <div className="flex justify-between">
            <span className="text-[#8B95A5]">진입가</span>
            <span className="text-white font-mono">
              {formatPrice(entryPrice)}{" "}
              {signal.category.startsWith("coin") ? "USDT" : ""}
            </span>
          </div>
          {signal.stop_loss && (
            <div className="flex justify-between">
              <span className="text-[#8B95A5]">손절</span>
              <span className="text-[#FF5252] font-mono">
                {formatPrice(Number(signal.stop_loss))}
                <span className="text-[10px] ml-1">
                  (
                  {(
                    ((Number(signal.stop_loss) - entryPrice) / entryPrice) *
                    100
                  ).toFixed(1)}
                  %)
                </span>
              </span>
            </div>
          )}
          {signal.take_profit_1 && (
            <div className="flex justify-between">
              <span className="text-[#8B95A5]">1차익절</span>
              <span className="text-[#00E676] font-mono">
                {formatPrice(Number(signal.take_profit_1))}
                <span className="text-[10px] ml-1">
                  (
                  {isLong ? "+" : "-"}
                  {Math.abs(
                    ((Number(signal.take_profit_1) - entryPrice) / entryPrice) *
                      100
                  ).toFixed(1)}
                  %)
                </span>
              </span>
            </div>
          )}
          {signal.take_profit_2 && (
            <div className="flex justify-between">
              <span className="text-[#8B95A5]">2차익절</span>
              <span className="text-[#00E676] font-mono">
                {formatPrice(Number(signal.take_profit_2))}
                <span className="text-[10px] ml-1">
                  (
                  {isLong ? "+" : "-"}
                  {Math.abs(
                    ((Number(signal.take_profit_2) - entryPrice) / entryPrice) *
                      100
                  ).toFixed(1)}
                  %)
                </span>
              </span>
            </div>
          )}
          {(signal.leverage_conservative || signal.leverage_aggressive) && (
            <div className="flex justify-between">
              <span className="text-[#8B95A5]">레버리지</span>
              <span className="text-white font-mono">
                {signal.leverage_conservative}x / {signal.leverage_aggressive}x
              </span>
            </div>
          )}
        </div>

        {/* Locked overlay */}
        {!canAccess && !isCompleted && (
          <div className="mt-3 flex items-center justify-center gap-2 p-2 rounded-lg bg-[#F5B800]/5 border border-[#F5B800]/20">
            <Lock className="w-4 h-4 text-[#F5B800]" />
            <span className="text-xs text-[#F5B800] font-medium">
              구독하고 시그널 확인하기
            </span>
          </div>
        )}

        {/* Current price & PnL */}
        {(price || isCompleted) && (
          <div className="mt-3 pt-3 border-t border-[#2A2D36]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {price && !isCompleted && (
                  <span className="text-sm text-white font-mono">
                    현재가 {formatPrice(price)}
                  </span>
                )}
                <span
                  className={cn(
                    "text-sm font-bold font-mono",
                    pnlPercent >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
                  )}
                >
                  ({pnlPercent >= 0 ? "+" : ""}
                  {pnlPercent.toFixed(2)}%)
                </span>
              </div>
              <Badge
                className={cn("text-[10px] border-0", statusColor)}
              >
                {statusLabel}
              </Badge>
            </div>

            {/* TP1 progress bar */}
            {signal.status === "active" && signal.take_profit_1 && price && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-[#8B95A5] mb-1">
                  <span>TP1까지</span>
                  <span>{Math.round(tp1Progress)}%</span>
                </div>
                <Progress
                  value={tp1Progress}
                  className="h-1.5 bg-[#2A2D36]"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function checkAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  const tierOrder: SubscriptionTier[] = ["free", "basic", "pro", "premium", "bundle"];
  return tierOrder.indexOf(userTier) >= tierOrder.indexOf(requiredTier);
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "진행중",
    hit_tp1: "TP1 도달",
    hit_tp2: "TP2 도달",
    hit_tp3: "TP3 도달",
    hit_sl: "손절",
    expired: "만료",
    cancelled: "취소",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  if (status === "active") return "bg-[#00E676]/10 text-[#00E676]";
  if (status.startsWith("hit_tp")) return "bg-[#00E676]/10 text-[#00E676]";
  if (status === "hit_sl") return "bg-[#FF5252]/10 text-[#FF5252]";
  return "bg-[#8B95A5]/10 text-[#8B95A5]";
}

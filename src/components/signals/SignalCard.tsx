"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Lock, Star, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { FilteredSignal } from "@/lib/tier-access";
import type { TierKey } from "@/lib/tier-access";
import { getInvestmentVerdict } from "@/lib/market-sentiment";
import DelayBadge from "./DelayBadge";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";
import Link from "next/link";

dayjs.extend(relativeTime);
dayjs.locale("ko");

interface SignalCardProps {
  signal: FilteredSignal;
  tier: TierKey;
  currentPrice?: number;
  buyWeight?: number;
  onUpgrade?: () => void;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("ko-KR");
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

const CATEGORY_LABELS: Record<string, string> = {
  coin_spot: "코인 현물",
  coin_futures: "코인 선물",
  overseas_futures: "해외주식",
  kr_stock: "국내주식",
};

export default function SignalCard({
  signal,
  tier,
  currentPrice,
  buyWeight,
}: SignalCardProps) {
  const isLong = signal.direction === "long" || signal.direction === "buy";
  const isCompleted = signal.status !== "active";
  const isBlurred = signal._tier_info.isBlurred;
  const lockedFields = signal._tier_info.lockedFields;

  // 투자 판정: buyWeight가 제공되면 가중 매수 점수 계산
  const weightedScore = buyWeight != null ? signal.confidence * buyWeight : null;
  const verdict = weightedScore != null ? getInvestmentVerdict(weightedScore) : null;

  // Calculate PnL
  const entryPrice = signal.entry_price ? Number(signal.entry_price) : 0;
  const price = currentPrice;
  let pnlPercent = 0;
  if (price && entryPrice && !isCompleted) {
    pnlPercent = isLong
      ? ((price - entryPrice) / entryPrice) * 100
      : ((entryPrice - price) / entryPrice) * 100;
  }
  const hasResult = isCompleted && signal.result_pnl_percent != null;
  if (hasResult) {
    pnlPercent = Number(signal.result_pnl_percent);
  }

  // TP1 progress
  let tp1Progress = 0;
  if (price && signal.take_profit_1 && !isCompleted && entryPrice) {
    const tp1 = Number(signal.take_profit_1);
    tp1Progress = isLong
      ? Math.min(100, Math.max(0, ((price - entryPrice) / (tp1 - entryPrice)) * 100))
      : Math.min(100, Math.max(0, ((entryPrice - price) / (entryPrice - tp1)) * 100));
  }

  return (
    <Link href={tier === "free" && !isCompleted ? "#" : `/app/signals/${signal.id}`}>
      <div
        className={cn(
          "relative rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-5 transition-all hover:border-[#3A3D46]",
          tier === "bundle" && signal.status === "active" && "border-[#F5B800]/20 shadow-[0_0_15px_rgba(245,184,0,0.05)]"
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
                isLong ? "bg-[#00E676]/10 text-[#00E676]" : "bg-[#FF5252]/10 text-[#FF5252]"
              )}
            >
              {isLong ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {signal.direction.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                fill={i < signal.confidence ? "#F5B800" : "none"}
                stroke={i < signal.confidence ? "#F5B800" : "#2A2D36"}
                className="w-3 h-3"
              />
            ))}
          </div>
        </div>

        {/* Category + Time + Delay Badge */}
        <div className="flex items-center gap-2 text-[11px] text-[#8B95A5] mb-4 flex-wrap">
          <span>{CATEGORY_LABELS[signal.category] || signal.category}</span>
          <span>·</span>
          <span>{dayjs(signal.created_at).fromNow()}</span>
          <DelayBadge tier={tier} />
          {verdict && !isBlurred && signal.status === "active" && (
            <>
              <span>·</span>
              <span
                className="font-bold text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ color: verdict.color, backgroundColor: verdict.bgColor }}
              >
                {verdict.emoji} {verdict.label}
              </span>
            </>
          )}
        </div>

        {/* Price Data */}
        <div className={cn("space-y-2.5 text-sm", isBlurred && "signal-blur")}>
          {/* Entry Price */}
          <PriceRow label="진입가" value={signal.entry_price} locked={!signal.entry_price} />

          {/* Stop Loss */}
          <PriceRow
            label="손절"
            value={signal.stop_loss}
            pnl={signal.entry_price && signal.stop_loss ? ((signal.stop_loss - signal.entry_price) / signal.entry_price) * 100 : undefined}
            color="text-[#FF5252]"
            locked={!signal.stop_loss}
          />

          {/* TP1 */}
          <PriceRow
            label="1차익절"
            value={signal.take_profit_1}
            pnl={signal.entry_price && signal.take_profit_1 ? ((signal.take_profit_1 - signal.entry_price) / signal.entry_price) * 100 : undefined}
            color="text-[#00E676]"
            locked={lockedFields.includes("take_profit_1")}
            lockLabel="Basic 이상"
          />

          {/* TP2 */}
          <PriceRow
            label="2차익절"
            value={signal.take_profit_2}
            pnl={signal.entry_price && signal.take_profit_2 ? ((signal.take_profit_2 - signal.entry_price) / signal.entry_price) * 100 : undefined}
            color="text-[#00E676]"
            locked={lockedFields.includes("take_profit_2")}
            lockLabel="Pro 이상"
          />

          {/* TP3 */}
          <PriceRow
            label="3차익절"
            value={signal.take_profit_3}
            pnl={signal.entry_price && signal.take_profit_3 ? ((signal.take_profit_3 - signal.entry_price) / signal.entry_price) * 100 : undefined}
            color="text-[#00E676]"
            locked={lockedFields.includes("take_profit_3")}
            lockLabel="Premium 이상"
          />

          {/* Leverage */}
          {(signal.leverage_conservative || lockedFields.includes("leverage_conservative")) && (
            <div className="flex justify-between">
              <span className="text-[#8B95A5]">레버리지</span>
              <span className="text-white font-mono">
                {signal.leverage_conservative ? `보수적 ${signal.leverage_conservative}x` : ""}
                {signal.leverage_aggressive
                  ? ` / 공격적 ${signal.leverage_aggressive}x`
                  : lockedFields.includes("leverage_aggressive") && signal.leverage_conservative
                    ? <span className="text-[#8B95A5]"> / <Lock className="w-3 h-3 inline" /> Premium</span>
                    : ""}
                {lockedFields.includes("leverage_conservative") && (
                  <span className="text-[#8B95A5]"><Lock className="w-3 h-3 inline mr-1" />Pro 이상</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Free overlay */}
        {isBlurred && !isCompleted && (
          <div className="mt-3 flex items-center justify-center gap-2 p-3 rounded-lg bg-[#F5B800]/5 border border-[#F5B800]/20">
            <Lock className="w-4 h-4 text-[#F5B800]" />
            <span className="text-xs text-[#F5B800] font-medium">
              {signal._tier_info.upgradeMessage || "구독하고 시그널 확인하기"}
            </span>
          </div>
        )}

        {/* AI Reasoning preview */}
        {signal.ai_reasoning && !isBlurred && (
          <div className="mt-3 pt-3 border-t border-[#2A2D36]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[#F5B800] font-medium text-[11px]">🤖 AI 분석</span>
              <Badge variant="outline" className="text-[8px] border-[#2A2D36] text-[#8B95A5] px-1 py-0">
                Claude Opus 4.6
              </Badge>
            </div>
            <p className="text-[11px] text-[#8B95A5] leading-relaxed">
              {signal.ai_reasoning
                .replace(/##?\s/g, "")
                .replace(/\*\*/g, "")
                .replace(/###?\s/g, "")
                .replace(/\n/g, " ")
                .substring(0, 200) + (signal.ai_reasoning.length > 200 ? "..." : "")}
            </p>
            <p className="text-[10px] text-[#F5B800]/70 mt-1.5 cursor-pointer hover:text-[#F5B800]">
              상세 분석 보기 →
            </p>
          </div>
        )}

        {/* Current price & PnL */}
        {(price || (isCompleted && hasResult)) && !isBlurred && (
          <div className="mt-3 pt-3 border-t border-[#2A2D36]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {price && !isCompleted && (
                  <span className="text-sm text-white font-mono">
                    현재가 {formatPrice(price)}
                  </span>
                )}
                {(price || hasResult) && (
                <span className={cn("text-sm font-bold font-mono", pnlPercent >= 0 ? "text-[#00E676]" : "text-[#FF5252]")}>
                  ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%)
                </span>
                )}
              </div>
              <Badge className={cn("text-[10px] border-0", getStatusColor(signal.status))}>
                {getStatusLabel(signal.status)}
              </Badge>
            </div>

            {signal.status === "active" && signal.take_profit_1 && price && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-[#8B95A5] mb-1">
                  <span>TP1까지</span>
                  <span>{Math.round(tp1Progress)}%</span>
                </div>
                <Progress value={tp1Progress} className="h-1.5 bg-[#2A2D36]" />
              </div>
            )}
          </div>
        )}

        {/* Completed signal result (visible to ALL tiers) */}
        {isCompleted && isBlurred && hasResult && (
          <div className="mt-3 pt-3 border-t border-[#2A2D36]">
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-bold font-mono", pnlPercent >= 0 ? "text-[#00E676]" : "text-[#FF5252]")}>
                결과: {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
              </span>
              <Badge className={cn("text-[10px] border-0", getStatusColor(signal.status))}>
                {getStatusLabel(signal.status)}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function PriceRow({
  label,
  value,
  pnl,
  color = "text-white",
  locked,
  lockLabel,
}: {
  label: string;
  value: number | null;
  pnl?: number;
  color?: string;
  locked: boolean;
  lockLabel?: string;
}) {
  if (locked) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-[#8B95A5]">{label}</span>
        <span className="text-[#8B95A5]/50 text-xs flex items-center gap-1">
          <Lock className="w-3 h-3" />
          {lockLabel || "잠김"}
        </span>
      </div>
    );
  }

  if (value === null) return null;

  return (
    <div className="flex justify-between">
      <span className="text-[#8B95A5]">{label}</span>
      <span className={cn("font-mono", color)}>
        {formatPrice(value)}
        {pnl !== undefined && (
          <span className={cn("text-[10px] ml-1", pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]")}>
            ({pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%)
          </span>
        )}
      </span>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "진행중", hit_tp1: "TP1", hit_tp2: "TP2", hit_tp3: "TP3",
    hit_sl: "손절", expired: "만료", cancelled: "취소",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  if (status === "active") return "bg-[#00E676]/10 text-[#00E676]";
  if (status.startsWith("hit_tp")) return "bg-[#00E676]/10 text-[#00E676]";
  if (status === "hit_sl") return "bg-[#FF5252]/10 text-[#FF5252]";
  return "bg-[#8B95A5]/10 text-[#8B95A5]";
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import SignalCard from "@/components/signals/SignalCard";
import TierUpgradeBanner from "@/components/signals/TierUpgradeBanner";
import { cn } from "@/lib/utils";
import { Lock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FilteredSignal, TierKey } from "@/lib/tier-access";
import { TIER_CONFIG } from "@/lib/tier-access";

const categories = [
  { key: "all", label: "전체" },
  { key: "coin_spot", label: "코인 현물" },
  { key: "coin_futures", label: "코인 선물" },
  { key: "overseas_futures", label: "해외선물" },
  { key: "kr_stock", label: "국내주식" },
];

export default function SignalFeedPage() {
  const [signals, setSignals] = useState<FilteredSignal[]>([]);
  const [userTier, setUserTier] = useState<TierKey>("free");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [viewedToday, setViewedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);

  const supabase = createClient();

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/signals?category=${selectedCategory}&limit=50`);
      const data = await res.json();

      if (data.error) {
        console.error(data.error);
        return;
      }

      setSignals(data.signals || []);
      setUserTier(data.userTier || "free");
      setViewedToday(data.viewedToday || 0);
      setDailyLimit(data.dailyLimit);
    } catch (error) {
      console.error("Failed to fetch signals:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("signals-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals" }, () => {
        fetchSignals();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "signals" }, () => {
        fetchSignals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchSignals]);

  // Binance WebSocket for real-time prices
  useEffect(() => {
    const cryptoSignals = signals.filter(
      (s) =>
        (s.category === "coin_spot" || s.category === "coin_futures") &&
        s.status === "active" &&
        !s._tier_info.isBlurred
    );
    if (cryptoSignals.length === 0) return;

    const symbols = [...new Set(cryptoSignals.map((s) => s.symbol.toLowerCase()))];
    const streams = symbols.map((s) => `${s}@ticker`).join("/");

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.s && data.c) {
            setPrices((prev) => ({ ...prev, [data.s]: parseFloat(data.c) }));
          }
        } catch { /* ignore */ }
      };
    } catch { /* WebSocket not available */ }

    return () => { if (ws) ws.close(); };
  }, [signals]);

  const tierConfig = TIER_CONFIG[userTier];
  const accessibleCategories = tierConfig.categories;

  const handleCategoryClick = (catKey: string) => {
    if (catKey === "all") {
      setSelectedCategory(catKey);
      return;
    }
    if (!(accessibleCategories as readonly string[]).includes(catKey) && userTier !== "free") {
      // Show upgrade prompt could be added here
    }
    setSelectedCategory(catKey);
  };

  return (
    <div className="py-4 space-y-4">
      {/* Upgrade banner */}
      <TierUpgradeBanner tier={userTier} />

      {/* Daily limit warning */}
      {dailyLimit !== null && viewedToday >= dailyLimit && (
        <div className="p-3 rounded-xl bg-[#FF5252]/5 border border-[#FF5252]/20 text-center">
          <p className="text-xs text-[#FF5252]">
            오늘 시그널 조회 한도({dailyLimit}개)를 초과했습니다. 업그레이드하면 더 많은 시그널을 확인할 수 있어요.
          </p>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => {
          const isLocked =
            cat.key !== "all" &&
            !(accessibleCategories as readonly string[]).includes(cat.key) &&
            userTier !== "free";
          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryClick(cat.key)}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                selectedCategory === cat.key
                  ? "bg-[#F5B800] text-[#0D0F14]"
                  : isLocked
                    ? "bg-[#1A1D26] text-[#8B95A5]/40"
                    : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
              )}
            >
              {isLocked && <Lock className="w-3 h-3" />}
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Active signal count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8B95A5]">
          시그널{" "}
          <span className="text-[#F5B800] font-bold">{signals.length}</span>개
          {dailyLimit !== null && (
            <span className="text-[10px] ml-2">
              (오늘 조회: {viewedToday}/{dailyLimit})
            </span>
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={fetchSignals} className="text-[#8B95A5] hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Signal list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#8B95A5]">시그널이 없습니다</p>
          <p className="text-sm text-[#8B95A5]/60 mt-1">매 4시간마다 새 시그널이 발행됩니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              tier={userTier}
              currentPrice={prices[signal.symbol]}
            />
          ))}
        </div>
      )}

      {/* Investment disclaimer */}
      <div className="mt-8 p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <p className="text-[10px] text-[#8B95A5] leading-relaxed">
          본 서비스는 투자 자문이 아니며, AI 분석 결과는 참고용입니다. 투자 결정은
          본인의 판단과 책임 하에 이루어져야 합니다. 과거 실적이 미래 수익을 보장하지 않습니다.
        </p>
      </div>
    </div>
  );
}

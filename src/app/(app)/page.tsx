"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import SignalCard from "@/components/signals/SignalCard";
import { cn } from "@/lib/utils";
import { Lock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Signal, SubscriptionTier, SignalWithPrice } from "@/types";
import { CATEGORY_LABELS, TIER_ACCESS } from "@/types";

const categories = [
  { key: "all", label: "전체" },
  { key: "coin_spot", label: "코인 현물" },
  { key: "coin_futures", label: "코인 선물" },
  { key: "overseas_futures", label: "해외선물" },
  { key: "kr_stock", label: "국내주식" },
];

export default function SignalFeedPage() {
  const [signals, setSignals] = useState<SignalWithPrice[]>([]);
  const [userTier, setUserTier] = useState<SubscriptionTier>("free");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<Record<string, number>>({});

  const supabase = createClient();

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      setUserTier((profile?.subscription_tier as SubscriptionTier) || "free");

      // Fetch signals
      let query = supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }

      const { data } = await query;
      setSignals((data as SignalWithPrice[]) || []);
    } catch (error) {
      console.error("Failed to fetch signals:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, supabase]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Realtime subscription for new signals
  useEffect(() => {
    const channel = supabase
      .channel("signals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => {
          const newSignal = payload.new as SignalWithPrice;
          if (
            selectedCategory === "all" ||
            newSignal.category === selectedCategory
          ) {
            setSignals((prev) => [newSignal, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "signals" },
        (payload) => {
          const updated = payload.new as SignalWithPrice;
          setSignals((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, selectedCategory]);

  // Binance WebSocket for real-time prices
  useEffect(() => {
    const cryptoSignals = signals.filter(
      (s) =>
        (s.category === "coin_spot" || s.category === "coin_futures") &&
        s.status === "active"
    );

    if (cryptoSignals.length === 0) return;

    const symbols = [...new Set(cryptoSignals.map((s) => s.symbol.toLowerCase()))];
    const streams = symbols.map((s) => `${s}@ticker`).join("/");
    const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;

    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.s && data.c) {
            setPrices((prev) => ({
              ...prev,
              [data.s]: parseFloat(data.c),
            }));
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch {
      // WebSocket not available
    }

    return () => {
      if (ws) ws.close();
    };
  }, [signals]);

  const accessibleCategories = TIER_ACCESS[userTier] || [];

  return (
    <div className="py-4 space-y-4">
      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => {
          const isLocked =
            cat.key !== "all" &&
            !accessibleCategories.includes(cat.key as keyof typeof CATEGORY_LABELS) &&
            userTier !== "free"; // free users can see all (with blur)
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                selectedCategory === cat.key
                  ? "bg-[#F5B800] text-[#0D0F14]"
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
          활성 시그널{" "}
          <span className="text-[#F5B800] font-bold">
            {signals.filter((s) => s.status === "active").length}
          </span>
          개
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSignals}
          className="text-[#8B95A5] hover:text-white"
        >
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
          <p className="text-sm text-[#8B95A5]/60 mt-1">
            매 4시간마다 새 시그널이 발행됩니다
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              userTier={userTier}
              currentPrice={prices[signal.symbol]}
            />
          ))}
        </div>
      )}

      {/* Investment disclaimer */}
      <div className="mt-8 p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <p className="text-[10px] text-[#8B95A5] leading-relaxed">
          본 서비스는 투자 자문이 아니며, AI 분석 결과는 참고용입니다. 투자 결정은
          본인의 판단과 책임 하에 이루어져야 합니다. 과거 실적이 미래 수익을
          보장하지 않습니다.
        </p>
      </div>
    </div>
  );
}

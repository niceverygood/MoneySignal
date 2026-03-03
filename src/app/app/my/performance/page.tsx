"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Download,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { TierKey } from "@/lib/tier-access";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface PerformanceData {
  stats: {
    totalFollowed: number;
    wins: number;
    losses: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
  };
  monthlyBreakdown: { month: string; pnl: number; count: number }[];
  categoryBreakdown: { category: string; count: number; pnl: number }[];
  cumulativePnl: { date: string; pnl: number }[];
  follows: {
    id: string;
    signal_id: string;
    followed_at: string;
    actual_pnl_percent: number | null;
    signals: {
      symbol: string;
      symbol_name: string;
      category: string;
      direction: string;
      result_pnl_percent: number | null;
    } | null;
  }[];
  tier: TierKey;
}

const CATEGORY_LABELS: Record<string, string> = {
  coin_spot: "코인 현물",
  coin_futures: "코인 선물",
  overseas_futures: "해외주식",
  kr_stock: "국내주식",
};

const PIE_COLORS = ["#F5B800", "#448AFF", "#E040FB", "#00E676"];

export default function PerformancePage() {
  const router = useRouter();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchPerformance = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("로그인이 필요합니다");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/performance", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "데이터를 불러올 수 없습니다");
      }

      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const handleCsvDownload = () => {
    if (!data?.follows) return;
    const headers = ["시그널", "심볼", "방향", "카테고리", "수익률(%)", "팔로우일"];
    const rows = data.follows.map((f) => [
      f.signals?.symbol_name || "",
      f.signals?.symbol || "",
      f.signals?.direction || "",
      f.signals?.category ? CATEGORY_LABELS[f.signals.category] || f.signals.category : "",
      f.actual_pnl_percent ?? f.signals?.result_pnl_percent ?? "",
      f.followed_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moneysignal-performance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#8B95A5] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">뒤로</span>
        </button>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-6 text-center">
          <p className="text-[#FF5252]">{error}</p>
        </Card>
      </div>
    );
  }

  const tier = data?.tier || "free";
  const stats = data?.stats || {
    totalFollowed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgPnl: 0,
    totalPnl: 0,
  };

  const isFreeTier = tier === "free";
  const isProPlus = tier === "pro" || tier === "premium" || tier === "bundle";
  const isPremiumPlus = tier === "premium" || tier === "bundle";

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#8B95A5] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-white">내 투자 성과</h1>
        </div>
        {isPremiumPlus && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCsvDownload}
            className="border-[#2A2D36] text-[#8B95A5] hover:text-white hover:bg-[#2A2D36] text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            CSV
          </Button>
        )}
      </div>

      {/* Free tier locked overlay */}
      {isFreeTier && (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-8 text-center relative">
          <div className="flex flex-col items-center gap-3">
            <Lock className="w-10 h-10 text-[#8B95A5]" />
            <p className="text-white font-semibold">Basic 이상에서 이용 가능</p>
            <p className="text-sm text-[#8B95A5]">
              시그널을 팔로우하고 투자 성과를 추적하세요
            </p>
            <Button
              onClick={() => router.push("/app/pricing")}
              className="mt-2 bg-[#F5B800] text-black hover:bg-[#F5B800]/90"
            >
              업그레이드하기
            </Button>
          </div>
        </Card>
      )}

      {/* Stats Cards (basic+) */}
      {!isFreeTier && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="📌 팔로우"
              value={`${stats.totalFollowed}개`}
              color="text-[#F5B800]"
            />
            <StatCard
              label="승률"
              value={`${stats.winRate.toFixed(1)}%`}
              color={stats.winRate >= 50 ? "text-[#00E676]" : "text-[#FF5252]"}
            />
            <StatCard
              label="평균 수익"
              value={`${stats.avgPnl >= 0 ? "+" : ""}${stats.avgPnl.toFixed(2)}%`}
              color={stats.avgPnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"}
            />
          </div>

          {/* Total PnL Banner */}
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {stats.totalPnl >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-[#00E676]" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-[#FF5252]" />
                )}
                <span className="text-sm text-[#8B95A5]">총 수익률</span>
              </div>
              <span
                className={cn(
                  "text-xl font-bold",
                  stats.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
                )}
              >
                {stats.totalPnl >= 0 ? "+" : ""}
                {stats.totalPnl.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-[#2A2D36]">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00E676]" />
                <span className="text-xs text-[#8B95A5]">
                  수익 {stats.wins}건
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#FF5252]" />
                <span className="text-xs text-[#8B95A5]">
                  손실 {stats.losses}건
                </span>
              </div>
            </div>
          </Card>

          {/* Monthly Bar Chart (pro+) */}
          {isProPlus && data?.monthlyBreakdown && data.monthlyBreakdown.length > 0 && (
            <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
              <h3 className="text-sm font-semibold text-white mb-4">월별 수익률</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2D36" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#8B95A5", fontSize: 11 }}
                      axisLine={{ stroke: "#2A2D36" }}
                    />
                    <YAxis
                      tick={{ fill: "#8B95A5", fontSize: 11 }}
                      axisLine={{ stroke: "#2A2D36" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1A1D26",
                        border: "1px solid #2A2D36",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      formatter={(value) => [`${Number(value).toFixed(2)}%`, "수익률"]}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {data.monthlyBreakdown.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.pnl >= 0 ? "#00E676" : "#FF5252"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Category Pie Chart (pro+) */}
          {isProPlus &&
            data?.categoryBreakdown &&
            data.categoryBreakdown.length > 0 && (
              <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
                <h3 className="text-sm font-semibold text-white mb-4">
                  카테고리별 분포
                </h3>
                <div className="flex items-center">
                  <div className="h-[180px] w-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.categoryBreakdown}
                          dataKey="count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={40}
                        >
                          {data.categoryBreakdown.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={PIE_COLORS[idx % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1A1D26",
                            border: "1px solid #2A2D36",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                          formatter={(value, name) => [
                            `${Number(value)}건`,
                            CATEGORY_LABELS[String(name)] || String(name),
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 ml-4">
                    {data.categoryBreakdown.map((item, idx) => (
                      <div key={item.category} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{
                            backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                        <span className="text-xs text-[#8B95A5]">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                        <span className="text-xs text-white ml-auto">
                          {item.count}건
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

          {/* Cumulative PnL Chart (premium+) */}
          {isPremiumPlus &&
            data?.cumulativePnl &&
            data.cumulativePnl.length > 0 && (
              <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
                <h3 className="text-sm font-semibold text-white mb-4">
                  누적 수익률 추이
                </h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.cumulativePnl}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2D36" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#8B95A5", fontSize: 11 }}
                        axisLine={{ stroke: "#2A2D36" }}
                      />
                      <YAxis
                        tick={{ fill: "#8B95A5", fontSize: 11 }}
                        axisLine={{ stroke: "#2A2D36" }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1A1D26",
                          border: "1px solid #2A2D36",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        formatter={(value) => [
                          `${Number(value).toFixed(2)}%`,
                          "누적 수익률",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="#F5B800"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "#F5B800" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

          {/* Pro upgrade prompt for basic users */}
          {!isProPlus && (
            <Card className="bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border-[#F5B800]/20 p-4">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-[#F5B800]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    Pro로 업그레이드
                  </p>
                  <p className="text-xs text-[#8B95A5]">
                    월별 차트, 카테고리 분석 등 더 자세한 성과 분석을 확인하세요
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Recent Follows List */}
          {data?.follows && data.follows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#8B95A5] mb-2 uppercase tracking-wider">
                최근 팔로우 시그널
              </h3>
              <div className="space-y-2">
                {data.follows.slice(0, 20).map((follow) => {
                  const pnl =
                    follow.actual_pnl_percent ??
                    follow.signals?.result_pnl_percent ??
                    null;
                  return (
                    <Card
                      key={follow.id}
                      className="bg-[#1A1D26] border-[#2A2D36] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {follow.signals?.symbol_name || "—"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className="text-[10px] bg-[#2A2D36] text-[#8B95A5] border-0">
                              {follow.signals?.category
                                ? CATEGORY_LABELS[follow.signals.category] ||
                                  follow.signals.category
                                : "—"}
                            </Badge>
                            <span className="text-[10px] text-[#8B95A5]">
                              {follow.signals?.direction === "long" || follow.signals?.direction === "buy"
                                ? "롱"
                                : "숏"}
                            </span>
                          </div>
                        </div>
                        {pnl !== null ? (
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
                            )}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {Number(pnl).toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-xs text-[#8B95A5]">진행중</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 text-center">
      <p className="text-[10px] text-[#8B95A5] mb-1">{label}</p>
      <p className={cn("text-base font-bold", color)}>{value}</p>
    </Card>
  );
}

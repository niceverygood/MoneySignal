"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Shield,
  Activity,
  Loader2,
  CalendarDays,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Signal } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

const categories = [
  { key: "all", label: "전체" },
  { key: "coin_spot", label: "코인 현물" },
  { key: "coin_futures", label: "코인 선물" },
  { key: "overseas_futures", label: "해외선물" },
  { key: "kr_stock", label: "국내주식" },
];

const periods = [
  { key: "30", label: "최근 30일" },
  { key: "90", label: "90일" },
  { key: "180", label: "6개월" },
  { key: "365", label: "1년" },
  { key: "9999", label: "전체" },
];

interface AggregateStats {
  totalSignals: number;
  winningSignals: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  totalPnl: number;
  profitFactor: number;
}

interface MonthlyData {
  month: string;
  signals: number;
  winRate: number;
  pnl: number;
}

export default function BacktestPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("90");
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/backtest?category=${selectedCategory}&period=${selectedPeriod}`
      );
      const data = await res.json();

      setStats(data.aggregateStats);
      setRecentSignals(data.recentSignals || []);

      // Extract monthly data from backtest results
      if (data.backtestResults?.length > 0) {
        const allMonthly = data.backtestResults.flatMap(
          (r: { monthly_breakdown: MonthlyData[] }) => r.monthly_breakdown || []
        );
        // Merge by month
        const monthMap: Record<string, MonthlyData> = {};
        for (const m of allMonthly) {
          if (!monthMap[m.month]) {
            monthMap[m.month] = { ...m };
          } else {
            monthMap[m.month].signals += m.signals;
            monthMap[m.month].pnl += m.pnl;
          }
        }
        setMonthlyData(
          Object.values(monthMap).sort((a, b) =>
            a.month.localeCompare(b.month)
          )
        );
      }
    } catch (error) {
      console.error("Failed to fetch backtest data:", error);
    }
    setLoading(false);
  }, [selectedCategory, selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="py-4 space-y-4">
      {/* Header with transparency badge */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">백테스트 실적</h1>
        <Badge
          variant="outline"
          className="border-[#F5B800]/30 text-[#F5B800] text-[10px] gap-1"
        >
          <Activity className="w-3 h-3" />
          LIVE
        </Badge>
      </div>

      {/* Transparency notice */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F5B800]/5 border border-[#F5B800]/10">
        <Shield className="w-4 h-4 text-[#F5B800] shrink-0" />
        <p className="text-[10px] text-[#8B95A5]">
          모든 시그널은 서버 타임스탬프로 기록되어 사후 수정이 불가능합니다.
          실제 시장가 기준으로 수익률이 계산됩니다.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              selectedCategory === cat.key
                ? "bg-[#F5B800] text-[#0D0F14]"
                : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Period tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setSelectedPeriod(p.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              selectedPeriod === p.key
                ? "bg-[#22262F] text-white border border-[#F5B800]/30"
                : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="총 시그널"
              value={stats?.totalSignals?.toString() || "0"}
              icon={BarChart3}
            />
            <StatCard
              label="승률"
              value={`${(stats?.winRate || 0).toFixed(1)}%`}
              icon={Target}
              highlight={stats?.winRate ? stats.winRate >= 60 : false}
            />
            <StatCard
              label="평균 수익"
              value={`+${(stats?.avgProfit || 0).toFixed(1)}%`}
              icon={TrendingUp}
              positive
            />
            <StatCard
              label="누적 수익률"
              value={`${(stats?.totalPnl || 0) >= 0 ? "+" : ""}${(stats?.totalPnl || 0).toFixed(1)}%`}
              icon={TrendingUp}
              positive={(stats?.totalPnl || 0) >= 0}
              large
            />
          </div>

          {/* Additional stats */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat
              label="평균 손실"
              value={`${(stats?.avgLoss || 0).toFixed(1)}%`}
              color="text-[#FF5252]"
            />
            <MiniStat
              label="손익비"
              value={`${(stats?.profitFactor || 0).toFixed(2)}`}
              color={
                (stats?.profitFactor || 0) >= 1.5
                  ? "text-[#00E676]"
                  : "text-[#F5B800]"
              }
            />
            <MiniStat
              label="승/패"
              value={`${stats?.winningSignals || 0}/${(stats?.totalSignals || 0) - (stats?.winningSignals || 0)}`}
              color="text-white"
            />
          </div>

          {/* Monthly chart (simplified bar chart) */}
          {monthlyData.length > 0 && (
            <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
              <h3 className="text-sm font-semibold text-[#8B95A5] mb-4 uppercase tracking-wider">
                월별 수익률
              </h3>
              <div className="space-y-2">
                {monthlyData.slice(-6).map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-[#8B95A5] w-16 shrink-0">
                      {m.month}
                    </span>
                    <div className="flex-1 h-5 bg-[#22262F] rounded-full overflow-hidden relative">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          m.pnl >= 0 ? "bg-[#00E676]" : "bg-[#FF5252]"
                        )}
                        style={{
                          width: `${Math.min(100, Math.abs(m.pnl))}%`,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs font-mono w-16 text-right",
                        m.pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
                      )}
                    >
                      {m.pnl >= 0 ? "+" : ""}
                      {m.pnl.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                viewMode === "list" ? "bg-[#F5B800] text-[#0D0F14]" : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
              )}
            >
              <List className="w-3.5 h-3.5" />
              리스트
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                viewMode === "calendar" ? "bg-[#F5B800] text-[#0D0F14]" : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              캘린더
            </button>
          </div>

          {/* Calendar View */}
          {viewMode === "calendar" && (
            <SignalCalendar
              signals={recentSignals}
              currentMonth={calendarMonth}
              onMonthChange={setCalendarMonth}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          )}

          {/* Recent Signals History (List View) */}
          {viewMode === "list" && (
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <h3 className="text-sm font-semibold text-[#8B95A5] mb-3 uppercase tracking-wider">
              최근 시그널 히스토리
            </h3>
            {recentSignals.length === 0 ? (
              <p className="text-sm text-[#8B95A5] text-center py-4">
                아직 완료된 시그널이 없습니다
              </p>
            ) : (
              <div className="space-y-0">
                {/* Table header */}
                <div className="grid grid-cols-[60px_1fr_60px_70px_40px] gap-2 text-[10px] text-[#8B95A5] pb-2 border-b border-[#2A2D36]">
                  <span>날짜</span>
                  <span>종목</span>
                  <span>방향</span>
                  <span className="text-right">수익률</span>
                  <span className="text-center">결과</span>
                </div>
                {recentSignals.slice(0, 20).map((signal) => {
                  const pnl = Number(signal.result_pnl_percent || 0);
                  const isWin = pnl > 0;
                  return (
                    <div
                      key={signal.id}
                      className="grid grid-cols-[60px_1fr_60px_70px_40px] gap-2 text-xs py-2 border-b border-[#2A2D36]/50 items-center"
                    >
                      <span className="text-[#8B95A5]">
                        {dayjs(signal.closed_at || signal.created_at).format(
                          "M/DD"
                        )}
                      </span>
                      <span className="text-white font-medium truncate">
                        {signal.symbol_name}
                      </span>
                      <Badge
                        className={cn(
                          "text-[9px] px-1 py-0 border-0 justify-center",
                          signal.direction === "long" ||
                            signal.direction === "buy"
                            ? "bg-[#00E676]/10 text-[#00E676]"
                            : "bg-[#FF5252]/10 text-[#FF5252]"
                        )}
                      >
                        {signal.direction.toUpperCase()}
                      </Badge>
                      <span
                        className={cn(
                          "text-right font-mono font-medium",
                          isWin ? "text-[#00E676]" : "text-[#FF5252]"
                        )}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(1)}%
                      </span>
                      <span className="text-center">
                        {isWin ? "✅" : "❌"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          )}
        </>
      )}

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <p className="text-[10px] text-[#8B95A5] leading-relaxed">
          과거 실적이 미래 수익을 보장하지 않습니다. 본 데이터는 AI 시그널의 참고
          실적이며, 실제 투자 수익과 다를 수 있습니다.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  positive,
  highlight,
  large,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
  highlight?: boolean;
  large?: boolean;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-[#8B95A5]" />
        <span className="text-[10px] text-[#8B95A5] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "font-bold font-mono",
          large ? "text-xl" : "text-lg",
          positive === true && "text-[#00E676]",
          positive === false && "text-[#FF5252]",
          highlight && "text-[#F5B800]",
          positive === undefined && !highlight && "text-white"
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-2.5 text-center">
      <p className="text-[10px] text-[#8B95A5] mb-0.5">{label}</p>
      <p className={cn("text-sm font-bold font-mono", color)}>{value}</p>
    </Card>
  );
}

// ============================================
// Signal Calendar Heatmap
// ============================================
function SignalCalendar({
  signals,
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
}: {
  signals: Signal[];
  currentMonth: dayjs.Dayjs;
  onMonthChange: (d: dayjs.Dayjs) => void;
  selectedDate: string | null;
  onDateSelect: (d: string | null) => void;
}) {
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  // Group signals by date
  const signalsByDate: Record<string, Signal[]> = {};
  for (const signal of signals) {
    const date = dayjs(signal.closed_at || signal.created_at).format("YYYY-MM-DD");
    if (!signalsByDate[date]) signalsByDate[date] = [];
    signalsByDate[date].push(signal);
  }

  // Calculate daily PnL
  const dailyPnl: Record<string, { total: number; wins: number; losses: number; signals: Signal[] }> = {};
  for (const [date, sigs] of Object.entries(signalsByDate)) {
    const wins = sigs.filter((s) => Number(s.result_pnl_percent || 0) > 0).length;
    const losses = sigs.length - wins;
    const total = sigs.reduce((sum, s) => sum + Number(s.result_pnl_percent || 0), 0);
    dailyPnl[date] = { total, wins, losses, signals: sigs };
  }

  // Generate calendar grid
  const startOfMonth = currentMonth.startOf("month");
  const endOfMonth = currentMonth.endOf("month");
  const startDay = startOfMonth.day(); // 0=Sun
  const daysInMonth = endOfMonth.date();

  const cells: Array<{ date: string; day: number; isCurrentMonth: boolean } | null> = [];

  // Fill leading empty cells
  for (let i = 0; i < startDay; i++) {
    cells.push(null);
  }

  // Fill days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = currentMonth.date(d).format("YYYY-MM-DD");
    cells.push({ date, day: d, isCurrentMonth: true });
  }

  const getCellColor = (date: string): string => {
    const data = dailyPnl[date];
    if (!data) return "";
    if (data.total > 5) return "bg-[#00E676]/40";
    if (data.total > 2) return "bg-[#00E676]/25";
    if (data.total > 0) return "bg-[#00E676]/12";
    if (data.total > -2) return "bg-[#FF5252]/12";
    if (data.total > -5) return "bg-[#FF5252]/25";
    return "bg-[#FF5252]/40";
  };

  const selectedSignals = selectedDate ? dailyPnl[selectedDate] : null;

  return (
    <div className="space-y-3">
      {/* Calendar */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(currentMonth.subtract(1, "month"))}
            className="text-[#8B95A5] hover:text-white h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-sm font-bold text-white">
            {currentMonth.format("YYYY년 M월")}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(currentMonth.add(1, "month"))}
            className="text-[#8B95A5] hover:text-white h-8 w-8 p-0"
            disabled={currentMonth.isAfter(dayjs(), "month")}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={cn(
                "text-center text-[10px] font-medium py-1",
                i === 0 ? "text-[#FF5252]/60" : i === 6 ? "text-[#448AFF]/60" : "text-[#8B95A5]/60"
              )}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const data = dailyPnl[cell.date];
            const hasSignals = !!data;
            const isSelected = selectedDate === cell.date;
            const isToday = cell.date === dayjs().format("YYYY-MM-DD");
            const dayOfWeek = dayjs(cell.date).day();

            return (
              <button
                key={cell.date}
                onClick={() => onDateSelect(isSelected ? null : cell.date)}
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all",
                  hasSignals ? getCellColor(cell.date) : "bg-[#22262F]/30",
                  isSelected && "ring-2 ring-[#F5B800]",
                  isToday && !isSelected && "ring-1 ring-[#8B95A5]/30",
                  hasSignals && "hover:ring-1 hover:ring-[#F5B800]/50 cursor-pointer",
                  !hasSignals && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    isToday ? "text-[#F5B800]" : dayOfWeek === 0 ? "text-[#FF5252]/70" : dayOfWeek === 6 ? "text-[#448AFF]/70" : "text-[#8B95A5]",
                    hasSignals && "text-white"
                  )}
                >
                  {cell.day}
                </span>
                {hasSignals && (
                  <div className="flex gap-0.5 mt-0.5">
                    {data.wins > 0 && (
                      <span className="w-1 h-1 rounded-full bg-[#00E676]" />
                    )}
                    {data.losses > 0 && (
                      <span className="w-1 h-1 rounded-full bg-[#FF5252]" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-[#2A2D36]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#00E676]/25" />
            <span className="text-[9px] text-[#8B95A5]">수익</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#FF5252]/25" />
            <span className="text-[9px] text-[#8B95A5]">손실</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#22262F]/30" />
            <span className="text-[9px] text-[#8B95A5]">시그널 없음</span>
          </div>
        </div>
      </Card>

      {/* Selected date detail */}
      {selectedSignals && (
        <Card className="bg-[#1A1D26] border-[#F5B800]/20 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white">
              {dayjs(selectedDate).format("M월 D일 (ddd)")} 시그널
            </h4>
            <div className="flex items-center gap-2">
              <Badge className={cn(
                "text-[10px] border-0",
                selectedSignals.total >= 0 ? "bg-[#00E676]/10 text-[#00E676]" : "bg-[#FF5252]/10 text-[#FF5252]"
              )}>
                {selectedSignals.total >= 0 ? "+" : ""}{selectedSignals.total.toFixed(1)}%
              </Badge>
              <span className="text-[10px] text-[#8B95A5]">
                {selectedSignals.wins}승 {selectedSignals.losses}패
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {selectedSignals.signals.map((signal) => {
              const pnl = Number(signal.result_pnl_percent || 0);
              const isWin = pnl > 0;
              return (
                <div
                  key={signal.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-[#22262F]/50"
                >
                  <span className="text-sm">{isWin ? "✅" : "❌"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">
                        {signal.symbol_name}
                      </span>
                      <Badge
                        className={cn(
                          "text-[8px] px-1 py-0 border-0",
                          signal.direction === "long" || signal.direction === "buy"
                            ? "bg-[#00E676]/10 text-[#00E676]"
                            : "bg-[#FF5252]/10 text-[#FF5252]"
                        )}
                      >
                        {signal.direction.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[8px] px-1 py-0 border-[#2A2D36] text-[#8B95A5]">
                        {CATEGORY_LABELS[signal.category] || signal.category}
                      </Badge>
                    </div>
                    {signal.ai_reasoning && (
                      <p className="text-[10px] text-[#8B95A5] mt-0.5 truncate">
                        {signal.ai_reasoning.replace(/[#*\n]/g, " ").substring(0, 60)}...
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "text-sm font-bold font-mono",
                      isWin ? "text-[#00E676]" : "text-[#FF5252]"
                    )}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                    </p>
                    <p className="text-[9px] text-[#8B95A5]">
                      {signal.status === "hit_tp1" ? "TP1" :
                       signal.status === "hit_tp2" ? "TP2" :
                       signal.status === "hit_tp3" ? "TP3" :
                       signal.status === "hit_sl" ? "SL" :
                       signal.status === "expired" ? "만료" : signal.status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

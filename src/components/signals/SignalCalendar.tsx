"use client";

// ============================================
// Signal Calendar Heatmap (공용)
// 날짜별 완료 시그널 수익/손실 히트맵 + 날짜 탭 시 상세
// 백테스트·메인 피드에서 함께 사용
// ============================================
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

const CATEGORY_LABELS: Record<string, string> = {
  coin_spot: "코인 현물",
  coin_futures: "코인 선물",
  overseas_futures: "해외주식",
  kr_stock: "국내주식",
};

// Signal / FilteredSignal 양쪽과 호환되는 최소 형태
export interface CalendarSignal {
  id: string;
  symbol_name: string;
  direction: string;
  category: string;
  status: string;
  result_pnl_percent: number | null;
  created_at: string;
  closed_at?: string | null;
  ai_reasoning?: string | null;
}

export default function SignalCalendar({ signals }: { signals: CalendarSignal[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => dayjs());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  // Group signals by date
  const signalsByDate: Record<string, CalendarSignal[]> = {};
  for (const signal of signals) {
    const date = dayjs(signal.closed_at || signal.created_at).format("YYYY-MM-DD");
    if (!signalsByDate[date]) signalsByDate[date] = [];
    signalsByDate[date].push(signal);
  }

  // Calculate daily PnL
  const dailyPnl: Record<string, { total: number; wins: number; losses: number; signals: CalendarSignal[] }> = {};
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

  const cells: Array<{ date: string; day: number } | null> = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = currentMonth.date(d).format("YYYY-MM-DD");
    cells.push({ date, day: d });
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
            onClick={() => setCurrentMonth(currentMonth.subtract(1, "month"))}
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
            onClick={() => setCurrentMonth(currentMonth.add(1, "month"))}
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
                onClick={() => setSelectedDate(isSelected ? null : cell.date)}
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

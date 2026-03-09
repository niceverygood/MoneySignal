"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Ban, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Signal } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import dayjs from "dayjs";

export default function AdminSignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: "all", status: "all", search: "" });
  const supabase = createClient();

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter.category !== "all") query = query.eq("category", filter.category);
    if (filter.status !== "all") query = query.eq("status", filter.status);
    if (filter.search) query = query.or(`symbol.ilike.%${filter.search}%,symbol_name.ilike.%${filter.search}%`);

    const { data } = await query;
    if (data) setSignals(data as Signal[]);
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const cancelSignal = async (id: string) => {
    await supabase
      .from("signals")
      .update({ status: "cancelled", closed_at: new Date().toISOString() })
      .eq("id", id);

    toast.success("시그널이 취소되었습니다");
    fetchSignals();
  };

  const triggerGeneration = async () => {
    try {
      const res = await fetch("/api/admin/trigger-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-signals" }),
      });
      if (res.ok) {
        toast.success("시그널 생성이 시작되었습니다");
      } else {
        toast.error("시그널 생성에 실패했습니다");
      }
    } catch {
      toast.error("요청에 실패했습니다");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">시그널 관리</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSignals}
            className="border-[#2A2D36] text-[#8B95A5]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={triggerGeneration}
            className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
          >
            수동 시그널 생성
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A5]" />
          <Input
            value={filter.search}
            onChange={(e) => setFilter((p) => ({ ...p, search: e.target.value }))}
            placeholder="종목명 또는 심볼 검색"
            className="pl-10 bg-[#1A1D26] border-[#2A2D36] text-white"
          />
        </div>
        <Select
          value={filter.category}
          onValueChange={(v) => setFilter((p) => ({ ...p, category: v }))}
        >
          <SelectTrigger className="w-40 bg-[#1A1D26] border-[#2A2D36] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
            <SelectItem value="all">전체 카테고리</SelectItem>
            <SelectItem value="coin_spot">코인 현물</SelectItem>
            <SelectItem value="coin_futures">코인 선물</SelectItem>
            <SelectItem value="overseas_futures">해외주식</SelectItem>
            <SelectItem value="kr_stock">국내주식</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filter.status}
          onValueChange={(v) => setFilter((p) => ({ ...p, status: v }))}
        >
          <SelectTrigger className="w-40 bg-[#1A1D26] border-[#2A2D36] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="hit_tp1">TP1</SelectItem>
            <SelectItem value="hit_tp2">TP2</SelectItem>
            <SelectItem value="hit_tp3">TP3</SelectItem>
            <SelectItem value="hit_sl">SL</SelectItem>
            <SelectItem value="expired">만료</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Signals table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
        {/* Mobile: Card List */}
        <div className="md:hidden space-y-2">
          {signals.map((signal) => {
            const pnl = Number(signal.result_pnl_percent || 0);
            return (
              <Card key={signal.id} className="bg-[#1A1D26] border-[#2A2D36] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm text-white font-medium">{signal.symbol_name}</p>
                    <p className="text-[10px] text-[#8B95A5]">{dayjs(signal.created_at).format("MM.DD HH:mm")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {signal.status !== "active" ? (
                      <span className={cn("text-sm font-mono font-bold", pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]")}>
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                      </span>
                    ) : (
                      signal.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => cancelSignal(signal.id)}
                          className="text-[#FF5252] hover:bg-[#FF5252]/10 h-7 px-2">
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="border-[#2A2D36] text-[#8B95A5] text-[10px]">{CATEGORY_LABELS[signal.category]}</Badge>
                  <Badge className={cn("text-[10px] border-0",
                    signal.direction === "long" || signal.direction === "buy" ? "bg-[#00E676]/10 text-[#00E676]" : "bg-[#FF5252]/10 text-[#FF5252]"
                  )}>{signal.direction.toUpperCase()}</Badge>
                  <span className="text-[10px] text-[#F5B800]">{"★".repeat(signal.confidence)}</span>
                  <Badge className={cn("text-[10px] border-0",
                    signal.status === "active" ? "bg-[#00E676]/10 text-[#00E676]"
                      : signal.status.startsWith("hit_tp") ? "bg-[#00E676]/10 text-[#00E676]"
                      : "bg-[#FF5252]/10 text-[#FF5252]"
                  )}>{signal.status}</Badge>
                  <span className="text-[10px] text-[#8B95A5] font-mono">{Number(signal.entry_price).toLocaleString()}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Desktop: Table */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2D36]">
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">날짜</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">종목</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">카테고리</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">방향</th>
                  <th className="text-right text-[10px] text-[#8B95A5] uppercase p-3">진입가</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">신뢰도</th>
                  <th className="text-right text-[10px] text-[#8B95A5] uppercase p-3">수익률</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">상태</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => {
                  const pnl = Number(signal.result_pnl_percent || 0);
                  return (
                    <tr key={signal.id} className="border-b border-[#2A2D36]/50 hover:bg-[#22262F]">
                      <td className="p-3 text-xs text-[#8B95A5]">{dayjs(signal.created_at).format("MM.DD HH:mm")}</td>
                      <td className="p-3 text-sm text-white font-medium">{signal.symbol_name}</td>
                      <td className="p-3"><Badge variant="outline" className="border-[#2A2D36] text-[#8B95A5] text-[10px]">{CATEGORY_LABELS[signal.category]}</Badge></td>
                      <td className="p-3"><Badge className={cn("text-[10px] border-0", signal.direction === "long" || signal.direction === "buy" ? "bg-[#00E676]/10 text-[#00E676]" : "bg-[#FF5252]/10 text-[#FF5252]")}>{signal.direction.toUpperCase()}</Badge></td>
                      <td className="p-3 text-sm text-white font-mono text-right">{Number(signal.entry_price).toLocaleString()}</td>
                      <td className="p-3 text-sm text-[#F5B800]">{"★".repeat(signal.confidence)}</td>
                      <td className="p-3 text-sm font-mono text-right">
                        {signal.status !== "active" ? (
                          <span className={pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%</span>
                        ) : (<span className="text-[#8B95A5]">-</span>)}
                      </td>
                      <td className="p-3"><Badge className={cn("text-[10px] border-0", signal.status === "active" ? "bg-[#00E676]/10 text-[#00E676]" : signal.status.startsWith("hit_tp") ? "bg-[#00E676]/10 text-[#00E676]" : "bg-[#FF5252]/10 text-[#FF5252]")}>{signal.status}</Badge></td>
                      <td className="p-3">
                        {signal.status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => cancelSignal(signal.id)} className="text-[#FF5252] hover:text-[#FF5252] hover:bg-[#FF5252]/10 h-7 px-2"><Ban className="w-3.5 h-3.5" /></Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}
    </div>
  );
}

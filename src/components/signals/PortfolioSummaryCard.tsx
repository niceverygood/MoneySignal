"use client";

// ============================================
// 메인 피드 상단 — 내 종목 손익 요약 카드
// 앱을 열자마자 "내 돈이 지금 어떤 상태인지" 보이게 하는 훅.
// 보유종목 없으면 등록 CTA, 있으면 총수익률 + 베스트/워스트 + AI 진단 유도.
// 60초마다 자동 갱신. 에러 시 조용히 숨김(피드 안 깨짐).
// ============================================
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Stethoscope, ChevronRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Holding {
  id: string;
  name: string;
  market: string;
  pnl_percent: number | null;
}

interface PortfolioData {
  holdings: Holding[];
  summary: { totalCost: number; totalValue: number; totalPnlPercent: number | null };
}

function fmtPnl(p: number): string {
  return `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
}

export default function PortfolioSummaryCard() {
  const router = useRouter();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const res = await fetch("/api/portfolio");
        if (disposed) return;
        if (!res.ok) {
          // 마이그레이션 미실행/일시 오류 등 — 피드를 깨뜨리지 않고 숨김
          setState("hidden");
          return;
        }
        const json: PortfolioData = await res.json();
        if (disposed) return;
        setData(json);
        setState("ready");
      } catch {
        if (!disposed) setState("hidden");
      }
    }

    load();
    const timer = setInterval(load, 60_000); // 60초 자동 갱신
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  if (state === "hidden") return null;

  if (state === "loading") {
    return (
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-3 w-24 bg-[#22262F] rounded" />
          <div className="h-5 w-16 bg-[#22262F] rounded" />
        </div>
      </Card>
    );
  }

  const holdings = data?.holdings || [];

  // ── 보유종목 없음: 등록 CTA ──
  if (holdings.length === 0) {
    return (
      <Card
        className="bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border-[#F5B800]/30 p-4 cursor-pointer hover:border-[#F5B800]/50 transition-all"
        onClick={() => router.push("/app/portfolio")}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F5B800]/15 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4.5 h-4.5 text-[#F5B800]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">들고 있는 종목, 어떡할지 고민되세요?</p>
            <p className="text-[11px] text-[#8B95A5]">평단가 등록하면 AI 3대장이 바로 진단해드려요</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#F5B800] shrink-0" />
        </div>
      </Card>
    );
  }

  // ── 보유 있음: 총수익률 + 베스트/워스트 ──
  const pnl = data?.summary.totalPnlPercent ?? null;
  const withPnl = holdings.filter((h) => h.pnl_percent !== null) as Array<Holding & { pnl_percent: number }>;
  const best = withPnl.length > 0 ? withPnl.reduce((a, b) => (a.pnl_percent >= b.pnl_percent ? a : b)) : null;
  const worst = withPnl.length > 1 ? withPnl.reduce((a, b) => (a.pnl_percent <= b.pnl_percent ? a : b)) : null;

  return (
    <Card
      className="bg-[#1A1D26] border-[#2A2D36] p-4 cursor-pointer hover:border-[#F5B800]/30 transition-all"
      onClick={() => router.push("/app/portfolio")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#F5B800]" />
          <span className="text-xs font-semibold text-[#8B95A5]">내 종목 {holdings.length}개</span>
        </div>
        {pnl !== null && (
          <span
            className={cn(
              "text-xl font-bold font-mono",
              pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
            )}
          >
            {fmtPnl(pnl)}
          </span>
        )}
      </div>

      {(best || worst) && (
        <div className="flex items-center gap-3 mt-2 text-[11px]">
          {best && (
            <span className="text-[#8B95A5] truncate">
              {best.name}{" "}
              <strong className={best.pnl_percent >= 0 ? "text-[#00E676]" : "text-[#FF5252]"}>
                {fmtPnl(best.pnl_percent)}
              </strong>
            </span>
          )}
          {worst && best && worst.id !== best.id && (
            <span className="text-[#8B95A5] truncate">
              {worst.name}{" "}
              <strong className={worst.pnl_percent >= 0 ? "text-[#00E676]" : "text-[#FF5252]"}>
                {fmtPnl(worst.pnl_percent)}
              </strong>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#2A2D36]">
        <span className="text-[11px] text-[#F5B800] font-medium flex items-center gap-1">
          <Stethoscope className="w-3.5 h-3.5" />
          지금 어떡할지 AI 3대장에게 물어보기
        </span>
        <ChevronRight className="w-4 h-4 text-[#F5B800]" />
      </div>
    </Card>
  );
}

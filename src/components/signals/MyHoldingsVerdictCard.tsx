"use client";

// ============================================
// 홈 최상단 핵심 히어로 — "내 종목, AI 3대장이 지금 뭐라고 보는가"를 0탭에 전면 노출.
//   머리: 검증 적중률 띠(anti-리딩방) · 척추: 보유종목별 평결 행(손실회피 정렬)
//   손익은 메타로 강등. 평결은 저장값(개인 진단 우선, 종목 일일합의 폴백)만 렌더 →
//   AI 신규호출 0원. 새 진단은 사용자가 종목에서 명시적으로 '받기' 탭할 때만.
// ============================================
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ChevronRight, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERDICT_STYLE, STOCK_VERDICT_STYLE } from "@/lib/verdict-style";

interface Verdict {
  source: "diagnosis" | "daily";
  consensus: string;
  summary: string | null;
  date: string;
}
interface Holding {
  id: string;
  name: string;
  market: string;
  pnl_percent: number | null;
  verdict: Verdict | null;
}
interface PortfolioData {
  holdings: Holding[];
  summary: { totalPnlPercent: number | null };
}

// 평결 → 시각 스타일 (개인 진단 / 종목 일일합의 분기 — daily의 buy/hold/sell는 VERDICT_STYLE에 없어 분기 필수)
function styleFor(v: Verdict): { label: string; color: string; bg: string } {
  const map = v.source === "daily" ? STOCK_VERDICT_STYLE : VERDICT_STYLE;
  return map[v.consensus] ?? { label: "분석", color: "#8B95A5", bg: "rgba(139,149,165,0.1)" };
}

// 주목도(높을수록 위로) — 손절·매도 우위를 상단에 띄워 손실회피 후크
const URGENCY: Record<string, number> = { cut: 5, sell: 4, reduce: 3, hold: 2, buy_more: 1, buy: 1 };
function urgencyOf(h: Holding): number {
  if (!h.verdict) return -1;
  return URGENCY[h.verdict.consensus] ?? 0;
}

// 합의 강도 마이크로카피 — diagnosis summary('AI N명 중 M명이 ...')만 파싱, daily는 고정
function strengthLabel(v: Verdict): string {
  if (v.source === "daily") return "시장 합의";
  const m = v.summary?.match(/AI\s*(\d+)명\s*중\s*(\d+)명/);
  if (!m) return "";
  const total = Number(m[1]);
  const agree = Number(m[2]);
  // '만장일치'는 3대장 모두 응답·동의했을 때만 (일부 AI 응답 누락 시 과대표기 방지)
  if (total >= 3 && agree >= total) return "만장일치";
  return `3대장 중 ${agree}명 동의`;
}

function fmtPnl(p: number): string {
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

export default function MyHoldingsVerdictCard() {
  const router = useRouter();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");

  useEffect(() => {
    let disposed = false;
    // 1회 fetch (포트폴리오 GET이 외부 실시세를 치므로 폴링 안 함 — 평결은 일 단위라 충분)
    fetch("/api/portfolio")
      .then((res) => {
        if (!res.ok) throw new Error("portfolio");
        return res.json();
      })
      .then((json: PortfolioData) => {
        if (disposed) return;
        setData(json);
        setState("ready");
      })
      .catch(() => {
        if (!disposed) setState("hidden"); // 마이그레이션 미실행/오류 — 피드 안 깨지게 숨김
      });
    return () => {
      disposed = true;
    };
  }, []);

  if (state === "hidden") return null;

  if (state === "loading") {
    return (
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-full bg-[#22262F] rounded-lg" />
          <div className="h-9 w-full bg-[#22262F] rounded-lg" />
          <div className="h-9 w-full bg-[#22262F] rounded-lg" />
        </div>
      </Card>
    );
  }

  const holdings = data?.holdings ?? [];

  // ── 빈 상태(신규): 박탈감 — 이미 검증된 AI가 '내 종목 자리'에 평결을 띄운다는 약속 ──
  if (holdings.length === 0) {
    const demo = [
      { name: "삼성전자", v: "보유 유지", s: "만장일치", color: VERDICT_STYLE.hold.color, bg: VERDICT_STYLE.hold.bg },
      { name: "비트코인", v: "비중 축소", s: "3대장 중 2명", color: VERDICT_STYLE.reduce.color, bg: VERDICT_STYLE.reduce.bg },
    ];
    return (
      <Card className="bg-[#1A1D26] border-[#F5B800]/30 p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#F5B800]" />
          <span className="text-sm font-bold text-white">AI 3대장 · 내 종목 평결</span>
        </div>
                <div>
          <p className="text-sm font-bold text-white">AI 3대장이 당신 종목을 매일 평결합니다</p>
          <p className="text-[11px] text-[#8B95A5] mt-0.5">— 아직 볼 게 없어요. 종목을 등록하면 바로 채워집니다.</p>
        </div>
        {/* 데모 평결 행 (blur + 자물쇠) — '내 종목 자리에 이게 뜬다'는 시각 약속 */}
        <div className="relative">
          <div className="space-y-2 blur-[3px] select-none pointer-events-none" aria-hidden>
            {demo.map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-lg bg-[#0D0F14] px-3 py-2.5">
                <span className="text-sm font-bold text-white">{d.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8B95A5]">{d.s}</span>
                  <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ color: d.color, backgroundColor: d.bg }}>
                    {d.v}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#F5B800] bg-[#0D0F14]/80 px-2 py-1 rounded-full">
              <Lock className="w-3 h-3" /> 예시
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push("/app/portfolio?add=1")}
          className="w-full rounded-lg bg-[#F5B800] text-[#0D0F14] font-bold text-sm py-3 hover:bg-[#FFD54F] transition-colors"
        >
          내 종목 등록하고 오늘 평결 받기
        </button>
        <p className="text-[10px] text-[#8B95A5]">참고용 AI 분석 · 1:1 투자자문 아님</p>
      </Card>
    );
  }

  // ── 보유 있음: 평결 척추 ──
  const sorted = [...holdings].sort((a, b) => {
    const u = urgencyOf(b) - urgencyOf(a);
    if (u !== 0) return u;
    return (a.pnl_percent ?? 0) - (b.pnl_percent ?? 0); // 동순위는 손실 큰 종목 먼저
  });
  const topRows = sorted.slice(0, 3);
  const totalPnl = data?.summary.totalPnlPercent ?? null;

  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-3">
      {/* 머리: 타이틀 + 총손익(강등) + 검증 적중률 띠 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#F5B800]" />
          <span className="text-sm font-bold text-white">AI 3대장 · 내 종목 평결</span>
        </div>
        {totalPnl !== null && (
          <span className="text-xs font-mono text-[#8B95A5]">
            내 손익{" "}
            <span className={totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"}>{fmtPnl(totalPnl)}</span>
          </span>
        )}
      </div>
      
      {/* 척추: 평결 행 */}
      <div className="space-y-2">
        {topRows.map((h) => {
          if (!h.verdict) {
            return (
              <button
                key={h.id}
                onClick={() => router.push(`/app/portfolio?holding=${h.id}`)}
                className="w-full flex items-center justify-between rounded-lg bg-[#0D0F14] px-3 py-2.5 hover:bg-[#15171F] transition-colors text-left"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-white truncate">{h.name}</span>
                  {h.pnl_percent !== null && (
                    <span className={cn("text-[10px] font-mono", h.pnl_percent >= 0 ? "text-[#00E676]" : "text-[#FF5252]")}>
                      {fmtPnl(h.pnl_percent)}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#F5B800] shrink-0">
                  오늘 평결 준비 중 · 받기 <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          }
          const st = styleFor(h.verdict);
          const strong = strengthLabel(h.verdict);
          const isAttention = h.verdict.consensus === "cut" || h.verdict.consensus === "reduce" || h.verdict.consensus === "sell";
          return (
            <button
              key={h.id}
              onClick={() => router.push(`/app/portfolio?holding=${h.id}`)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg bg-[#0D0F14] px-3 py-2.5 hover:bg-[#15171F] transition-colors text-left",
                isAttention && "border-l-[3px]"
              )}
              style={isAttention ? { borderLeftColor: st.color } : undefined}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-white truncate">{h.name}</span>
                {h.pnl_percent !== null && (
                  <span className={cn("text-[10px] font-mono", h.pnl_percent >= 0 ? "text-[#00E676]" : "text-[#FF5252]")}>
                    {fmtPnl(h.pnl_percent)}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {strong && <span className="text-[10px] text-[#8B95A5]">{strong}</span>}
                <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>
                  {st.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {holdings.length > 3 && (
        <button
          onClick={() => router.push("/app/portfolio")}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-[#F5B800] font-medium pt-0.5"
        >
          내 종목 {holdings.length}개 평결 전체보기 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      <p className="text-[10px] text-[#8B95A5] pt-0.5 border-t border-[#2A2D36]">참고용 AI 분석 · 1:1 투자자문 아님</p>
    </Card>
  );
}

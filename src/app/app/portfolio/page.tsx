"use client";

// ============================================
// 내 종목 — 보유종목 실시간 손익 + AI 3대장 진단
// "내가 산 종목, 지금 어떡해?"에 바로 답하는 화면
// ============================================
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader2,
  Stethoscope,
  Sparkles,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { STOCK_DB } from "@/lib/stock-db";
import { TOP_CRYPTO_SYMBOLS, SYMBOL_NAMES } from "@/lib/binance";
import { AI_CHARACTERS } from "@/lib/ai-characters";

// ============================================
// Types
// ============================================
interface Holding {
  id: string;
  market: "kr_stock" | "crypto";
  symbol: string;
  name: string;
  avg_price: number;
  quantity: number;
  current_price: number | null;
  pnl_percent: number | null;
}

interface AIOpinion {
  characterId: string;
  verdict: "hold" | "buy_more" | "reduce" | "cut";
  comment: string;
}

interface Diagnosis {
  symbol: string;
  name: string;
  currentPrice: number;
  pnlPercent: number;
  consensus: "hold" | "buy_more" | "reduce" | "cut";
  consensusLabel: string;
  consensusSummary: string;
  opinions: AIOpinion[];
  createdAt: string;
}

// ============================================
// 검색 후보 (국내주식 + 코인 통합)
// ============================================
interface SearchItem {
  market: "kr_stock" | "crypto";
  symbol: string;
  name: string;
  sub: string;
}

const SEARCH_ITEMS: SearchItem[] = [
  ...Object.values(STOCK_DB).map((s) => ({
    market: "kr_stock" as const,
    symbol: s.code,
    name: s.name,
    sub: `국내주식 · ${s.sector}`,
  })),
  ...TOP_CRYPTO_SYMBOLS.map((sym) => ({
    market: "crypto" as const,
    symbol: sym,
    name: SYMBOL_NAMES[sym] || sym,
    sub: `코인 · ${sym.replace("USDT", "")}`,
  })),
];

const VERDICT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  buy_more: { label: "추가매수 고려", color: "#00E676", bg: "rgba(0,230,118,0.1)" },
  hold: { label: "보유 유지", color: "#448AFF", bg: "rgba(68,138,255,0.1)" },
  reduce: { label: "비중 축소", color: "#F5B800", bg: "rgba(245,184,0,0.1)" },
  cut: { label: "손절 검토", color: "#FF5252", bg: "rgba(255,82,82,0.1)" },
};

function fmtPrice(n: number, market: string): string {
  if (market === "kr_stock") return `${Math.round(n).toLocaleString()}원`;
  return n >= 100 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function fmtPnl(p: number | null): string {
  if (p === null) return "—";
  return `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
}

// ============================================
// Page
// ============================================
export default function PortfolioPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<{ totalPnlPercent: number | null }>({ totalPnlPercent: null });
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);

  // 종목 추가 폼
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [avgPrice, setAvgPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // 진단 상태
  const [diagnosing, setDiagnosing] = useState<string | null>(null); // holding id
  const [diagnoses, setDiagnoses] = useState<Record<string, Diagnosis>>({}); // holding id → 결과
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(false);
    try {
      const [pRes, dRes] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/portfolio/diagnose"),
      ]);
      if (pRes.ok) {
        const data = await pRes.json();
        setHoldings(data.holdings || []);
        setSummary(data.summary || { totalPnlPercent: null });
      } else {
        setError(true); // 빈 상태로 위장하지 않고 명시적 에러 표시
      }
      if (dRes.ok) {
        const data = await dRes.json();
        setRemaining(data.remaining);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_ITEMS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query]);

  const handleAdd = async () => {
    if (!selected) return;
    const price = parseFloat(avgPrice.replace(/,/g, ""));
    const qty = parseFloat(quantity.replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("평단가를 입력해주세요");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("수량을 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: selected.market,
          symbol: selected.symbol,
          name: selected.name,
          avgPrice: price,
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "추가 실패");
        return;
      }
      toast.success(`${selected.name} 추가됨`);
      setShowAdd(false);
      setQuery("");
      setSelected(null);
      setAvgPrice("");
      setQuantity("");
      setLoading(true);
      fetchAll();
    } catch {
      toast.error("추가에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Holding) => {
    if (!confirm(`${h.name}을(를) 삭제할까요?`)) return;
    const res = await fetch(`/api/portfolio?id=${h.id}`, { method: "DELETE" });
    if (res.ok) {
      setHoldings((prev) => prev.filter((x) => x.id !== h.id));
      toast.success("삭제됨");
    } else {
      toast.error("삭제 실패");
    }
  };

  const handleDiagnose = async (h: Holding) => {
    if (diagnosing) return;
    setDiagnosing(h.id);
    setExpanded(h.id);
    try {
      const res = await fetch("/api/portfolio/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdingId: h.id }),
      });
      const data = await res.json();
      if (res.status === 429) {
        toast.error(data.error || "오늘 진단 횟수를 모두 사용했습니다");
        setRemaining(0);
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "진단에 실패했습니다");
        return;
      }
      setDiagnoses((prev) => ({ ...prev, [h.id]: data }));
      if (data.remaining !== null) setRemaining(data.remaining);
    } catch {
      toast.error("진단 요청에 실패했습니다");
    } finally {
      setDiagnosing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#F5B800]" />
        <p className="text-xs text-[#8B95A5]">보유종목을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#F5B800]" />
            내 종목 AI 진단
          </h1>
          <p className="text-xs text-[#8B95A5] mt-1">
            보유종목을 등록하면 AI 3대장이 보유/추매/손절을 진단합니다
          </p>
        </div>
        {remaining !== null && (
          <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 shrink-0">
            오늘 {remaining}회 남음
          </Badge>
        )}
      </div>

      {/* 포트폴리오 요약 */}
      {holdings.length > 0 && summary.totalPnlPercent !== null && (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 text-center">
          <p className="text-[10px] text-[#8B95A5] uppercase tracking-wider">내 포트폴리오 평가 수익률</p>
          <p
            className={cn(
              "text-3xl font-bold font-mono mt-1",
              summary.totalPnlPercent >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
            )}
          >
            {fmtPnl(summary.totalPnlPercent)}
          </p>
        </Card>
      )}

      {/* 보유종목 리스트 */}
      {error ? (
        <Card className="bg-[#1A1D26] border-[#FF5252]/30 p-6 text-center space-y-3">
          <p className="text-sm text-white font-semibold">불러오지 못했습니다</p>
          <p className="text-xs text-[#8B95A5]">네트워크를 확인하고 다시 시도해주세요.</p>
          <Button
            onClick={() => { setLoading(true); fetchAll(); }}
            variant="outline"
            className="border-[#2A2D36] text-white hover:bg-[#22262F]"
          >
            다시 시도
          </Button>
        </Card>
      ) : holdings.length === 0 ? (
        <Card className="bg-[#1A1D26] border-[#F5B800]/30 p-6 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-[#F5B800] mx-auto" />
          <p className="text-sm text-white font-semibold">들고 있는 종목, 지금 어떡할지 고민되세요?</p>
          <p className="text-xs text-[#8B95A5]">
            종목과 평단가를 등록하면<br />AI 3대장이 보유·추가매수·손절을 바로 진단해드립니다
          </p>
          <Button
            onClick={() => setShowAdd(true)}
            className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
          >
            <Plus className="w-4 h-4 mr-1" /> 첫 종목 등록하기
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {holdings.map((h) => {
            const diag = diagnoses[h.id];
            const isOpen = expanded === h.id;
            const pnlColor =
              h.pnl_percent === null ? "text-[#8B95A5]" : h.pnl_percent >= 0 ? "text-[#00E676]" : "text-[#FF5252]";
            return (
              <Card key={h.id} className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-3">
                {/* 종목 행 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{h.name}</p>
                      <span className="text-[10px] text-[#8B95A5]">
                        {h.market === "kr_stock" ? "국내주식" : "코인"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8B95A5] mt-0.5">
                      평단 {fmtPrice(h.avg_price, h.market)}
                      {h.current_price !== null && <> → 현재 {fmtPrice(h.current_price, h.market)}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-lg font-bold font-mono", pnlColor)}>{fmtPnl(h.pnl_percent)}</p>
                  </div>
                </div>

                {/* 액션 행 */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleDiagnose(h)}
                    disabled={diagnosing !== null}
                    className="flex-1 h-9 bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold text-xs"
                  >
                    {diagnosing === h.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        AI 3대장 진단 중...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="w-3.5 h-3.5 mr-1.5" />
                        AI 진단받기
                      </>
                    )}
                  </Button>
                  {diag && (
                    <Button
                      variant="outline"
                      onClick={() => setExpanded(isOpen ? null : h.id)}
                      className="h-9 border-[#2A2D36] text-[#8B95A5] text-xs px-2.5"
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(h)}
                    className="h-9 border-[#2A2D36] text-[#8B95A5] hover:text-[#FF5252] px-2.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* 진단 결과 */}
                {diag && isOpen && (
                  <div className="space-y-2.5 pt-2 border-t border-[#2A2D36]">
                    {/* 합의 평결 */}
                    <div
                      className="rounded-lg p-3 text-center"
                      style={{ backgroundColor: VERDICT_STYLE[diag.consensus].bg }}
                    >
                      <p className="text-[10px] text-[#8B95A5]">AI 3대장 합의 평결</p>
                      <p
                        className="text-xl font-bold mt-0.5"
                        style={{ color: VERDICT_STYLE[diag.consensus].color }}
                      >
                        {diag.consensusLabel}
                      </p>
                      <p className="text-[10px] text-[#8B95A5] mt-0.5">{diag.consensusSummary}</p>
                    </div>

                    {/* 개별 AI 의견 */}
                    {diag.opinions.map((op) => {
                      const char = AI_CHARACTERS[op.characterId];
                      const vs = VERDICT_STYLE[op.verdict];
                      if (!char) return null;
                      return (
                        <div key={op.characterId} className="bg-[#22262F] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{char.avatar}</span>
                              <span className="text-xs font-bold text-white">{char.name}</span>
                              <span className="text-[9px] text-[#8B95A5]">{char.role}</span>
                            </div>
                            <Badge
                              className="border-0 text-[9px] px-1.5"
                              style={{ backgroundColor: vs.bg, color: vs.color }}
                            >
                              {vs.label}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[#C0C0C0] leading-relaxed">{op.comment}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          <Button
            onClick={() => setShowAdd(true)}
            variant="outline"
            className="w-full border-dashed border-[#2A2D36] text-[#8B95A5] hover:text-white h-11"
          >
            <Plus className="w-4 h-4 mr-1" /> 종목 추가
          </Button>
        </div>
      )}

      {/* 진단 횟수 소진 → 업그레이드 CTA */}
      {remaining === 0 && (
        <Card
          className="bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border-[#F5B800]/30 p-4 cursor-pointer"
          onClick={() => router.push("/app/subscribe")}
        >
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-[#F5B800] shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">오늘 진단을 다 쓰셨어요</p>
              <p className="text-[11px] text-[#8B95A5]">구독하면 매일 더 많은 종목을 진단받을 수 있습니다 →</p>
            </div>
          </div>
        </Card>
      )}

      {/* 종목 추가 모달(인라인) */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">종목 추가</h3>
              <button onClick={() => setShowAdd(false)} className="text-[#8B95A5] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!selected ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8B95A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="종목명 검색 (삼성전자, 비트코인...)"
                    className="bg-[#22262F] border-[#2A2D36] text-white pl-9"
                  />
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={`${r.market}:${r.symbol}`}
                      onClick={() => setSelected(r)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#22262F] hover:bg-[#2A2D36] text-left"
                    >
                      <span className="text-sm text-white">{r.name}</span>
                      <span className="text-[10px] text-[#8B95A5]">{r.sub}</span>
                    </button>
                  ))}
                  {query && results.length === 0 && (
                    <p className="text-xs text-[#8B95A5] text-center py-4">
                      검색 결과 없음 — 주요 종목/코인만 지원됩니다
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#22262F]">
                  <span className="text-sm font-bold text-white">{selected.name}</span>
                  <button onClick={() => setSelected(null)} className="text-[10px] text-[#F5B800]">
                    변경
                  </button>
                </div>
                <div>
                  <p className="text-[11px] text-[#8B95A5] mb-1">
                    평단가 ({selected.market === "kr_stock" ? "원" : "USDT"})
                  </p>
                  <Input
                    inputMode="decimal"
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(e.target.value)}
                    placeholder={selected.market === "kr_stock" ? "예: 72000" : "예: 64000"}
                    className="bg-[#22262F] border-[#2A2D36] text-white font-mono"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-[#8B95A5] mb-1">보유 수량</p>
                  <Input
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="예: 10"
                    className="bg-[#22262F] border-[#2A2D36] text-white font-mono"
                  />
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={saving}
                  className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold h-11"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  등록하기
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 면책 */}
      <p className="text-[10px] text-[#8B95A5]/60 text-center leading-relaxed pb-2">
        AI 진단은 투자자문이 아닌 참고용 분석 정보입니다.
        <br />
        투자 판단과 책임은 본인에게 있습니다.
      </p>
    </div>
  );
}

"use client";

// ============================================
// 온보딩 3스텝 — 가입 직후 활성화 흐름
// ① 보유종목 등록 → ② 첫 무료 AI 진단 → ③ 알림 허용
// 모든 스텝 건너뛰기 가능. 끝나면 /app.
// ============================================
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Stethoscope, Bell, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { STOCK_DB } from "@/lib/stock-db";
import { TOP_CRYPTO_SYMBOLS, SYMBOL_NAMES } from "@/lib/binance";
import { AI_CHARACTERS } from "@/lib/ai-characters";

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

interface DiagnosisResult {
  consensus: string;
  consensusLabel: string;
  consensusSummary: string;
  pnlPercent: number;
  opinions: Array<{ characterId: string; verdict: string; comment: string }>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0: 종목등록, 1: 첫진단, 2: 알림
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [avgPrice, setAvgPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  // 온보딩에 진입한 순간 완료로 표시 — 완료하든 건너뛰든 다음 로그인부터 재진입 안 함.
  // (이메일 가입 경로는 콜백을 안 거치므로 여기서 플립. .then을 호출해야 실제 요청이 전송됨)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").update({ onboarded: true }).eq("id", data.user.id)
          .then(({ error }) => { if (error) console.error("[onboarding] onboarded 표시 실패:", error.message); });
      }
    });
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_ITEMS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [query]);

  const finish = () => router.replace("/app");

  const handleRegister = async () => {
    if (!selected) return;
    const price = parseFloat(avgPrice.replace(/,/g, ""));
    const qty = parseFloat(quantity.replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) return toast.error("평단가를 입력해주세요");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("수량을 입력해주세요");
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
      if (!res.ok) return toast.error(data.error || "등록 실패");
      setHoldingId(data.id);
      setStep(1);
    } catch {
      toast.error("등록에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleDiagnose = async () => {
    if (!holdingId || diagnosing) return;
    setDiagnosing(true);
    try {
      const res = await fetch("/api/portfolio/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "진단에 실패했습니다");
        return;
      }
      setDiagnosis(data);
    } catch {
      toast.error("진단 요청에 실패했습니다");
    } finally {
      setDiagnosing(false);
    }
  };

  const handlePush = async () => {
    setPushBusy(true);
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { registerPushNotifications } = await import("@/lib/capacitor");
        await registerPushNotifications();
      }
      setPushDone(true);
      toast.success("알림 설정 완료!");
    } catch {
      toast.error("알림 설정에 실패했습니다. 설정에서 다시 켤 수 있어요.");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="py-6 space-y-5 max-w-sm mx-auto">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "w-6 bg-[#F5B800]" : i < step ? "w-1.5 bg-[#F5B800]/50" : "w-1.5 bg-[#2A2D36]"
            )}
          />
        ))}
      </div>

      {/* ── Step 0: 보유종목 등록 ── */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="text-center">
            <Sparkles className="w-8 h-8 text-[#F5B800] mx-auto mb-2" />
            <h1 className="text-xl font-bold text-white">어떤 종목 들고 계세요?</h1>
            <p className="text-xs text-[#8B95A5] mt-1.5 leading-relaxed">
              평단가를 등록하면 AI 3대장이<br />보유·추가매수·손절을 바로 진단해드려요
            </p>
          </div>

          {!selected ? (
            <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8B95A5] absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="삼성전자, 비트코인..."
                  className="bg-[#22262F] border-[#2A2D36] text-white pl-9"
                />
              </div>
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
            </Card>
          ) : (
            <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#22262F]">
                <span className="text-sm font-bold text-white">{selected.name}</span>
                <button onClick={() => setSelected(null)} className="text-[10px] text-[#F5B800]">변경</button>
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
                onClick={handleRegister}
                disabled={saving}
                className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold h-11"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                등록하고 진단 받으러 가기
              </Button>
            </Card>
          )}

          <button onClick={finish} className="w-full text-center text-xs text-[#8B95A5] hover:text-white py-2">
            나중에 할래요
          </button>
        </div>
      )}

      {/* ── Step 1: 첫 무료 진단 ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center">
            <Stethoscope className="w-8 h-8 text-[#F5B800] mx-auto mb-2" />
            <h1 className="text-xl font-bold text-white">첫 AI 진단, 무료예요</h1>
            <p className="text-xs text-[#8B95A5] mt-1.5">
              방금 등록한 종목을 AI 3대장이 바로 진단해드립니다
            </p>
          </div>

          {!diagnosis ? (
            <Button
              onClick={handleDiagnose}
              disabled={diagnosing}
              className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold h-12"
            >
              {diagnosing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  AI 3대장이 분석 중... (10초 정도 걸려요)
                </>
              ) : (
                "무료로 AI 진단 받기"
              )}
            </Button>
          ) : (
            <div className="space-y-2.5">
              <div
                className="rounded-lg p-4 text-center"
                style={{ backgroundColor: VERDICT_STYLE[diagnosis.consensus]?.bg }}
              >
                <p className="text-[10px] text-[#8B95A5]">AI 3대장 합의 평결</p>
                <p
                  className="text-2xl font-bold mt-0.5"
                  style={{ color: VERDICT_STYLE[diagnosis.consensus]?.color }}
                >
                  {diagnosis.consensusLabel}
                </p>
                <p className="text-[10px] text-[#8B95A5] mt-0.5">{diagnosis.consensusSummary}</p>
              </div>
              {diagnosis.opinions.map((op) => {
                const char = AI_CHARACTERS[op.characterId];
                const vs = VERDICT_STYLE[op.verdict];
                if (!char) return null;
                return (
                  <div key={op.characterId} className="bg-[#1A1D26] border border-[#2A2D36] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">
                        {char.avatar} {char.name}
                      </span>
                      <Badge className="border-0 text-[9px] px-1.5" style={{ backgroundColor: vs?.bg, color: vs?.color }}>
                        {vs?.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#C0C0C0] leading-relaxed">{op.comment}</p>
                  </div>
                );
              })}
              <p className="text-[10px] text-[#8B95A5] leading-relaxed px-1 pt-0.5">
                ※ 참고용 AI 분석 시뮬레이션이며, 개별 1:1 투자자문이 아닙니다. 투자 판단과 책임은 본인에게 있습니다.
              </p>
            </div>
          )}

          <Button
            onClick={() => setStep(2)}
            variant={diagnosis ? "default" : "outline"}
            className={cn(
              "w-full h-11 font-semibold",
              diagnosis
                ? "bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
                : "border-[#2A2D36] text-[#8B95A5]"
            )}
          >
            {diagnosis ? "다음" : "건너뛰기"}
          </Button>
        </div>
      )}

      {/* ── Step 2: 알림 허용 ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center">
            <Bell className="w-8 h-8 text-[#F5B800] mx-auto mb-2" />
            <h1 className="text-xl font-bold text-white">시그널, 놓치지 마세요</h1>
            <p className="text-xs text-[#8B95A5] mt-1.5 leading-relaxed">
              새 시그널 발행·목표가 도달 시<br />실시간 알림을 보내드립니다
            </p>
          </div>

          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-2 text-xs text-[#C0C0C0]">
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" /> 새 AI 시그널 발행 즉시</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" /> 익절(TP)·손절(SL) 도달 알림</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" /> 매일 아침 AI 3대장 평결</p>
          </Card>

          {!pushDone ? (
            <Button
              onClick={handlePush}
              disabled={pushBusy}
              className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold h-12"
            >
              {pushBusy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              알림 켜기
            </Button>
          ) : (
            <Button onClick={finish} className="w-full bg-[#00E676] text-[#0D0F14] hover:bg-[#00E676]/90 font-semibold h-12">
              <CheckCircle2 className="w-4 h-4 mr-2" /> 시작하기
            </Button>
          )}

          <button onClick={finish} className="w-full text-center text-xs text-[#8B95A5] hover:text-white py-2">
            {pushDone ? "" : "나중에 설정할래요"}
          </button>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Shield,
  Brain,
  Zap,
  ChevronRight,
  Star,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isOpenRouterAvailable } from "@/lib/openrouter";

// 완료된 시그널을 카테고리별로 집계 — 랜딩 실적은 하드코딩이 아닌 실데이터만 표시
async function getLandingStats() {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("signals")
      .select("category, result_pnl_percent")
      .neq("status", "active")
      .not("result_pnl_percent", "is", null);
    if (!data || data.length === 0) return [];
    const labels: Record<string, string> = {
      coin_spot: "코인 현물",
      coin_futures: "코인 선물",
      overseas_futures: "해외주식",
      kr_stock: "국내주식",
    };
    const map = new Map<string, { count: number; wins: number; pnl: number }>();
    for (const s of data) {
      const cat = s.category as string;
      const pnl = Number(s.result_pnl_percent) || 0;
      const e = map.get(cat) || { count: 0, wins: 0, pnl: 0 };
      e.count += 1;
      if (pnl > 0) e.wins += 1;
      e.pnl += pnl;
      map.set(cat, e);
    }
    return [...map.entries()]
      .filter(([, v]) => v.count >= 5) // 최소 표본 미만은 미표시 (정직성)
      .map(([cat, v]) => ({
        label: labels[cat] || cat,
        winRate: Math.round((v.wins / v.count) * 100),
        pnl: Math.round(v.pnl),
        signals: v.count,
      }));
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const landingStats = await getLandingStats();
  // OpenRouter 키가 있을 때만 진짜 3개 모델(Claude·Gemini·GPT)이 도므로, 그때만 "3대장"을 명시
  const aiActive = isOpenRouterAvailable();
  return (
    <div className="min-h-screen bg-[#0D0F14]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#0D0F14]/95 backdrop-blur-sm border-b border-[#2A2D36] pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-gold-gradient">
            MONEY SIGNAL
          </span>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button
                variant="ghost"
                className="text-[#8B95A5] hover:text-white"
              >
                로그인
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold">
                회원가입
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5B800]/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 py-20 md:py-32 text-center relative">
          <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 mb-6">
            <Zap className="w-3 h-3 mr-1" />
            AI 기반 실시간 매매 시그널
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            AI가 포착한 매수 시그널,
            <br />
            <span className="text-gold-gradient">실시간으로 받아보세요</span>
          </h1>
          <p className="text-lg md:text-xl text-[#8B95A5] max-w-2xl mx-auto mb-10">
            코인·선물·주식 — {aiActive ? "Claude·Gemini·GPT 3개 AI가 토론하여" : "AI가 다관점으로 분석해"} 도출한 매매 시그널을 구독자에게
            실시간으로 제공합니다. 서버 기록 기반 투명한 실적 공개.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-bold text-lg px-8 h-14"
              >
                회원가입
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <Link href="/app/backtest">
              <Button
                size="lg"
                variant="outline"
                className="border-[#2A2D36] text-white hover:bg-[#1A1D26] text-lg px-8 h-14"
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                실적 확인하기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Signal Preview */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            실시간 AI 시그널 미리보기
          </h2>
          <p className="text-[#8B95A5]">
            매 4시간마다 {aiActive ? "AI 3대장이 합의한" : "AI가 분석한"} 시그널이 발행됩니다
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              symbol: "BTC/USDT",
              direction: "LONG",
              pnl: "+12.3%",
              status: "TP3 도달",
              isWin: true,
            },
            {
              symbol: "삼성전자",
              direction: "BUY",
              pnl: "+5.8%",
              status: "TP2 도달",
              isWin: true,
            },
            {
              symbol: "SOL/USDT",
              direction: "LONG",
              pnl: "+8.4%",
              status: "TP2 도달",
              isWin: true,
            },
          ].map((signal, i) => (
            <Card
              key={i}
              className="bg-[#1A1D26] border-[#2A2D36] p-4 hover:border-[#F5B800]/20 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-bold">{signal.symbol}</span>
                <Badge
                  className={
                    signal.direction === "LONG"
                      ? "bg-[#00E676]/10 text-[#00E676] border-0"
                      : "bg-[#FF5252]/10 text-[#FF5252] border-0"
                  }
                >
                  {signal.direction}
                </Badge>
              </div>
              <div className="signal-blur space-y-1 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-[#8B95A5]">진입가</span>
                  <span className="text-white">●●,●●●</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A5]">목표가</span>
                  <span className="text-white">●●,●●●</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#2A2D36]">
                <span
                  className={`text-lg font-bold font-mono ${signal.isWin ? "text-[#00E676]" : "text-[#FF5252]"}`}
                >
                  {signal.pnl}
                </span>
                <Badge
                  className={
                    signal.isWin
                      ? "bg-[#00E676]/10 text-[#00E676] border-0"
                      : "bg-[#FF5252]/10 text-[#FF5252] border-0"
                  }
                >
                  {signal.isWin ? "✅" : "❌"} {signal.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-[#8B95A5] mt-4">
          위 카드는 예시 화면입니다. 가입하면 실시간 시그널의 상세 정보를 확인할 수 있습니다.
        </p>
      </section>

      {/* Stats */}
      <section className="bg-[#1A1D26]/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              누적 시그널 실적
            </h2>
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4 text-[#F5B800]" />
              <p className="text-sm text-[#8B95A5]">
                서버 타임스탬프 기록 · 실제 완료된 시그널만 집계
              </p>
            </div>
          </div>
          {landingStats.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {landingStats.map((stat, i) => (
                <Card
                  key={i}
                  className="bg-[#1A1D26] border-[#2A2D36] p-4 text-center"
                >
                  <p className="text-sm text-[#F5B800] font-medium mb-3">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-white mb-1">
                    {stat.winRate}%
                  </p>
                  <p className="text-xs text-[#8B95A5] mb-3">승률</p>
                  <div className="flex justify-between text-xs border-t border-[#2A2D36] pt-3">
                    <div>
                      <p className={stat.pnl >= 0 ? "text-[#00E676] font-bold" : "text-[#FF5252] font-bold"}>
                        {stat.pnl >= 0 ? "+" : ""}{stat.pnl}%
                      </p>
                      <p className="text-[#8B95A5]">누적</p>
                    </div>
                    <div>
                      <p className="text-white font-bold">{stat.signals}</p>
                      <p className="text-[#8B95A5]">시그널</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center p-8 rounded-xl bg-[#1A1D26] border border-[#2A2D36]">
              <BarChart3 className="w-10 h-10 text-[#8B95A5]/40 mx-auto mb-3" />
              <p className="text-sm text-white font-medium mb-1">
                실적을 집계하고 있습니다
              </p>
              <p className="text-xs text-[#8B95A5]">
                완료된 시그널이 충분히 쌓이면 카테고리별 실제 승률·수익률을 공개합니다.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Products */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            구독 상품
          </h2>
          <p className="text-[#8B95A5]">
            투자 스타일에 맞는 상품을 선택하세요
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            {
              name: "Basic",
              price: "2.9",
              features: ["코인 현물 시그널", "1시간 주기 발행", "TP1 공개"],
            },
            {
              name: "Pro",
              price: "9.9",
              features: ["코인 현물+선물", "30분 주기 발행", "AI 상세 분석"],
              highlight: true,
            },
            {
              name: "Premium",
              price: "19.9",
              features: ["전 카테고리 실시간", "5분 주기 발행", "무제한 시그널"],
            },
            {
              name: "VIP Bundle",
              price: "49.9",
              features: ["1분 주기 선공개", "1:1 상담 월 2회", "VIP 전용 채널"],
            },
          ].map((product, i) => (
            <Card
              key={i}
              className={`bg-[#1A1D26] border-[#2A2D36] p-5 relative ${product.highlight ? "border-[#F5B800] shadow-[0_0_20px_rgba(245,184,0,0.15)]" : ""}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-bold text-white">
                  {product.name}
                </h3>
                {product.highlight && (
                  <Badge className="bg-[#F5B800] text-[#0D0F14] border-0">
                    <Star className="w-3 h-3 mr-1" />
                    인기
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-[#F5B800] mb-4">
                <span className="text-sm text-[#8B95A5]">월</span>{" "}
                {product.price}
                <span className="text-sm text-[#8B95A5]">만원</span>
              </p>
              <div className="space-y-2 mb-5">
                {product.features.map((f, j) => (
                  <div key={j} className="flex items-center gap-2 text-sm text-[#8B95A5]">
                    <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/auth/signup">
                <Button
                  className={`w-full ${product.highlight ? "bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]" : "bg-[#22262F] text-white hover:bg-[#2A2D36]"}`}
                >
                  시작하기
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-[#1A1D26]/50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              왜 머니시그널인가?
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#F5B800]/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-[#F5B800]" />
              </div>
              <h3 className="text-white font-semibold mb-2">투명한 실적</h3>
              <p className="text-sm text-[#8B95A5]">
                서버 기록 기반으로 사후 수정이 불가능합니다. 실시간 시장가로
                수익률을 계산합니다.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#F5B800]/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-6 h-6 text-[#F5B800]" />
              </div>
              <h3 className="text-white font-semibold mb-2">{aiActive ? "AI 3대장 합의" : "AI 다관점 분석"}</h3>
              <p className="text-sm text-[#8B95A5]">
                {aiActive
                  ? "Claude·Gemini·GPT가 3라운드 토론 후 합의한 시그널만 발행합니다."
                  : "AI가 다관점에서 3라운드로 교차 검토한 시그널만 발행합니다."}
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#F5B800]/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-[#F5B800]" />
              </div>
              <h3 className="text-white font-semibold mb-2">30일 무료 실적</h3>
              <p className="text-sm text-[#8B95A5]">
                완료된 시그널의 수익률은 무료로 공개합니다. 직접 확인 후
                결정하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A2D36] py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-lg font-bold text-gold-gradient">
                MONEY SIGNAL
              </span>
              <p className="text-xs text-[#8B95A5] mt-1">
                Powered by 주식회사 바틀 (Bottle Inc.)
              </p>
            </div>
            <div className="flex items-center gap-6 text-xs text-[#8B95A5]">
              <Link href="/terms" className="hover:text-white transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                개인정보처리방침
              </Link>
              <Link href="/disclaimer" className="hover:text-white transition-colors">
                투자 주의사항
              </Link>
              <span>contact@moneysignal.io</span>
            </div>
          </div>
          <div className="mt-6 p-3 rounded-lg bg-[#1A1D26]">
            <p className="text-[10px] text-[#8B95A5] leading-relaxed text-center">
              본 서비스는 투자 자문이 아니며, AI 분석 결과는 참고용입니다. 투자
              결정은 본인의 판단과 책임 하에 이루어져야 합니다. 과거 실적이 미래
              수익을 보장하지 않습니다.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

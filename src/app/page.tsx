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
  Users,
  DollarSign,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0D0F14]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#0D0F14]/95 backdrop-blur-sm border-b border-[#2A2D36]">
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
                무료 시작하기
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
            코인·선물·주식 — 3개 AI가 토론하여 도출한 매매 시그널을 구독자에게
            실시간으로 제공합니다. 서버 기록 기반 투명한 실적 공개.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-bold text-lg px-8 h-14"
              >
                무료 시작하기
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
            매 4시간마다 AI 3대장이 합의한 시그널이 발행됩니다
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              symbol: "BTC/USDT",
              direction: "LONG",
              pnl: "+7.5%",
              status: "TP2 도달",
              isWin: true,
            },
            {
              symbol: "ETH/USDT",
              direction: "SHORT",
              pnl: "-2.1%",
              status: "손절",
              isWin: false,
            },
            {
              symbol: "SOL/USDT",
              direction: "LONG",
              pnl: "+3.2%",
              status: "TP1 도달",
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
          가입하면 실시간 시그널의 상세 정보를 확인할 수 있습니다
        </p>
      </section>

      {/* Stats */}
      <section className="bg-[#1A1D26]/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              최근 6개월 실적
            </h2>
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4 text-[#F5B800]" />
              <p className="text-sm text-[#8B95A5]">
                서버 타임스탬프 기록, 조작 불가능
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "코인 현물", winRate: "65%", pnl: "+142%", signals: "324" },
              { label: "코인 선물", winRate: "67%", pnl: "+234%", signals: "256" },
              { label: "해외선물", winRate: "61%", pnl: "+89%", signals: "187" },
              { label: "국내주식 Top5", winRate: "72%", pnl: "+67%", signals: "180" },
            ].map((stat, i) => (
              <Card
                key={i}
                className="bg-[#1A1D26] border-[#2A2D36] p-4 text-center"
              >
                <p className="text-sm text-[#F5B800] font-medium mb-3">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-white mb-1">
                  {stat.winRate}
                </p>
                <p className="text-xs text-[#8B95A5] mb-3">승률</p>
                <div className="flex justify-between text-xs border-t border-[#2A2D36] pt-3">
                  <div>
                    <p className="text-[#00E676] font-bold">{stat.pnl}</p>
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
              name: "코인 현물",
              price: "2.9~9.9",
              features: ["BTC, ETH 등 Top 20", "AI 현물 매수 시그널", "실시간 알림"],
            },
            {
              name: "코인 선물",
              price: "4.9~19.9",
              features: ["Long/Short 양방향", "레버리지 제안", "손절/익절 자동 설정"],
              highlight: true,
            },
            {
              name: "해외선물",
              price: "9.9~29.9",
              features: ["나스닥, S&P, 금, 원유", "거시경제 AI 분석", "주요 이벤트 알림"],
            },
            {
              name: "국내주식 Top5",
              price: "0.9~2.9",
              features: ["AI 3대장 토론", "매주 Top 5 추천", "펀더멘털 분석"],
            },
          ].map((product, i) => (
            <Card
              key={i}
              className={`bg-[#1A1D26] border-[#2A2D36] p-5 ${product.highlight ? "border-[#F5B800]/30 card-glow" : ""}`}
            >
              {product.highlight && (
                <Badge className="bg-[#F5B800] text-[#0D0F14] border-0 mb-3">
                  <Star className="w-3 h-3 mr-1" />
                  인기
                </Badge>
              )}
              <h3 className="text-lg font-bold text-white mb-2">
                {product.name}
              </h3>
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
              <h3 className="text-white font-semibold mb-2">AI 3대장 합의</h3>
              <p className="text-sm text-[#8B95A5]">
                Claude, Gemini, GPT-4가 3라운드 토론 후 합의된 시그널만
                발행합니다.
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

      {/* Partner CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <Card className="bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border-[#F5B800]/20 p-8 md:p-12 text-center">
          <Users className="w-10 h-10 text-[#F5B800] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">
            리딩방 운영자라면? 파트너로 합류하세요
          </h2>
          <p className="text-[#8B95A5] mb-2">
            매출의 80~88% 수익 · 자동 결제·정산·대시보드 제공
          </p>
          <div className="flex items-center justify-center gap-4 my-6 text-sm text-[#8B95A5]">
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-[#00E676]" />
              매출 80~88% 수익
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4 text-[#448AFF]" />
              자동 대시보드
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-[#F5B800]" />
              AI 시그널 자동 제공
            </span>
          </div>
          <Link href="/partner/apply">
            <Button
              size="lg"
              className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-bold"
            >
              파트너 신청하기
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
        </Card>
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
              <Link href="#" className="hover:text-white transition-colors">
                이용약관
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                개인정보처리방침
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
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

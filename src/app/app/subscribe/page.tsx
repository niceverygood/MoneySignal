"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Crown,
  Star,
  Loader2,
  Zap,
  Lock,
  X,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriptionTier } from "@/types";
import { PLAN_PRICES } from "@/lib/portone";

// ============================================
// Plan definitions
// ============================================
type BillingCycle = "monthly" | "quarterly" | "yearly";

const PLANS = [
  {
    tier: "free" as const,
    name: "Free",
    desc: "AI 시그널 체험",
    color: "#8B95A5",
    frequency: "없음",
    frequencyBar: 0,
    features: {
      signal: ["완료 시그널 결과 공개", "진입가/손절가 공개"],
      analysis: ["AI 질문 3회/일 (맛보기)"],
      alert: [],
      vip: [],
    },
    locked: ["시그널 딜레이 무한", "카테고리 없음", "목표가 비공개", "레버리지 비공개"],
  },
  {
    tier: "basic" as const,
    name: "Basic",
    desc: "코인 현물 입문",
    color: "#448AFF",
    frequency: "1시간",
    frequencyBar: 25,
    freeTrial: true,
    features: {
      signal: ["코인 현물 시그널", "1일 3개", "30분 딜레이", "TP1 공개"],
      analysis: ["AI 분석 요약 (100자)", "백테스트 30일", "기본 대시보드"],
      alert: ["앱 푸시 알림", "TP1 도달 알림"],
      vip: [],
    },
    locked: ["코인 선물", "해외주식", "국내주식"],
  },
  {
    tier: "pro" as const,
    name: "Pro",
    desc: "본격 트레이딩",
    color: "#F5B800",
    popular: true,
    frequency: "30분",
    frequencyBar: 50,
    freeTrial: true,
    features: {
      signal: ["코인 현물+선물", "1일 10개", "10분 딜레이", "TP1~2 공개", "보수적 레버리지"],
      analysis: ["AI 상세 분석", "AI 질문 3회/일", "백테스트 180일", "상세 대시보드", "주간 리포트"],
      alert: ["앱 푸시 + 텔레그램", "TP1~2 + SL 알림"],
      vip: [],
    },
    locked: ["해외주식", "국내주식"],
  },
  {
    tier: "premium" as const,
    name: "Premium",
    desc: "프로 트레이더",
    color: "#E040FB",
    frequency: "5분",
    frequencyBar: 80,
    features: {
      signal: ["전 카테고리 (코인+주식)", "무제한 시그널", "실시간 (딜레이 0)", "TP1~3 전체", "보수적+공격적 레버리지"],
      analysis: ["AI 전체 분석 근거", "AI 질문 10회/일", "백테스트 전체 이력", "고급 대시보드", "주간 리포트 + 일일 브리핑", "CSV 다운로드"],
      alert: ["앱 푸시 + 텔레그램", "TP1~3 + SL + 취소/만료 알림"],
      vip: [],
    },
    locked: [],
  },
  {
    tier: "bundle" as const,
    name: "VIP Bundle",
    desc: "최상위 특권",
    color: "#F5B800",
    frequency: "1분",
    frequencyBar: 100,
    features: {
      signal: ["Premium 전체 포함", "1시간 선공개", "AI 질문 무제한"],
      analysis: ["월간 종합 리포트", "전체 분석+모델 정보"],
      alert: ["전체 알림 + VIP 채널"],
      vip: ["VIP 전용 텔레그램", "프리미엄 채팅방", "1:1 상담 월 2회"],
    },
    locked: [],
  },
];

const COMPARISON_SECTIONS = [
  {
    title: "시그널 접근",
    rows: [
      { label: "카테고리", values: ["없음", "코인 현물", "현물+선물", "전체", "전체"] },
      { label: "일일 한도", values: ["0", "3개", "10개", "무제한", "무제한"] },
      { label: "딜레이", values: ["-", "30분", "10분", "실시간", "1h 선공개"] },
      { label: "TP 레벨", values: ["0", "TP1", "TP1~2", "TP1~3", "TP1~3"] },
      { label: "레버리지", values: ["-", "-", "보수적", "전체", "전체"] },
    ],
  },
  {
    title: "AI 분석",
    rows: [
      { label: "AI 분석 근거", values: ["-", "요약", "상세", "전체", "전체+모델"] },
      { label: "AI 종목 질문", values: ["3회", "-", "3회/일", "10회/일", "무제한"] },
      { label: "백테스트", values: ["7일", "30일", "180일", "전체", "전체"] },
    ],
  },
  {
    title: "리포트",
    rows: [
      { label: "주간 리포트", values: ["-", "-", "O", "O", "O"] },
      { label: "일일 브리핑", values: ["-", "-", "-", "O", "O"] },
      { label: "월간 종합", values: ["-", "-", "-", "-", "O"] },
      { label: "CSV 내보내기", values: ["-", "-", "-", "O", "O"] },
    ],
  },
  {
    title: "알림",
    rows: [
      { label: "앱 푸시", values: ["-", "O", "O", "O", "O"] },
      { label: "텔레그램", values: ["-", "-", "O", "O", "O"] },
      { label: "SL 알림", values: ["-", "-", "O", "O", "O"] },
    ],
  },
  {
    title: "VIP 전용",
    rows: [
      { label: "VIP 채널", values: ["-", "-", "-", "-", "O"] },
      { label: "프리미엄 채팅", values: ["-", "-", "-", "-", "O"] },
      { label: "1:1 상담", values: ["-", "-", "-", "-", "월 2회"] },
    ],
  },
];

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function getDiscountPercent(tier: string, cycle: BillingCycle): number | null {
  const prices = PLAN_PRICES[tier];
  if (!prices || cycle === "monthly") return null;
  const monthlyTotal = cycle === "quarterly" ? prices.monthly * 3 : prices.monthly * 12;
  const actual = prices[cycle];
  const pct = Math.round(((monthlyTotal - actual) / monthlyTotal) * 100);
  return pct > 0 ? pct : null;
}

// ============================================
// Component
// ============================================
export default function SubscribePage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>("free");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [referralCode, setReferralCode] = useState("");
  const [referralPartner, setReferralPartner] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    async function fetchTier() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier, referred_by")
        .eq("id", user.id)
        .single();
      if (data) {
        setCurrentTier(data.subscription_tier as SubscriptionTier);
      }
    }
    fetchTier();
  }, [supabase]);

  const handleReferralCheck = async () => {
    if (!referralCode) return;
    try {
      const res = await fetch(`/api/partner/referral?code=${referralCode}`);
      const data = await res.json();
      if (res.ok) {
        setReferralPartner(data.partner.brand_name);
        toast.success(`${data.partner.brand_name} 운영자 확인!`);
      } else {
        toast.error(data.error);
        setReferralPartner(null);
      }
    } catch {
      toast.error("코드 확인 실패");
    }
  };

  const handleSubscribe = async (tier: string, price: number) => {
    setSubscribing(tier);

    if (price === 0) {
      try {
        if (referralCode && referralPartner) {
          await fetch("/api/partner/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referralCode }),
          });
        }
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier,
            amount: 0,
            referralCode: referralCode || null,
            billingCycle: "monthly",
            paymentMethod: "free_trial",
          }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error); return; }
        toast.success(`${tier.toUpperCase()} 무료 체험이 시작되었습니다!`);
        router.push("/app");
        return;
      } catch { toast.error("처리 중 오류"); } finally { setSubscribing(null); }
      return;
    }

    try {
      const { default: PortOne } = await import("@portone/browser-sdk/v2");
      const tierNames: Record<string, string> = { basic: "Basic", pro: "Pro", premium: "Premium", bundle: "VIP Bundle" };
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const response = await PortOne.requestIssueBillingKey({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "",
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "",
        billingKeyMethod: "CARD",
        issueId: `BK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        issueName: `머니시그널 ${tierNames[tier] || tier} 정기구독`,
        customer: {
          customerId: authUser?.id || undefined,
          email: authUser?.email || undefined,
        },
      });

      if (response?.code) {
        if (response.code === "FAILURE_TYPE_PG") {
          toast.error("카드 등록에 실패했습니다. 다시 시도해주세요.");
        } else {
          toast.error(response.message || "카드 등록이 취소되었습니다.");
        }
        setSubscribing(null);
        return;
      }

      if (!response?.billingKey) {
        toast.error("빌링키 발급에 실패했습니다.");
        setSubscribing(null);
        return;
      }

      toast.loading("결제 처리 중...");

      if (referralCode && referralPartner) {
        await fetch("/api/partner/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode }),
        });
      }

      const issueRes = await fetch("/api/billing/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingKey: response.billingKey,
          tier,
          billingCycle,
          referralCode: referralCode || null,
        }),
      });

      const issueData = await issueRes.json();
      toast.dismiss();

      if (!issueRes.ok) {
        toast.error(issueData.error || "결제 처리 실패");
        return;
      }

      toast.success(`${tierNames[tier] || tier} 구독이 시작되었습니다!`);
      router.push("/app");
    } catch (err) {
      console.error("Payment error:", err);
      toast.dismiss();
      toast.error("결제 처리 중 오류가 발생했습니다");
    } finally {
      setSubscribing(null);
    }
  };

  const tierOrder = ["free", "basic", "pro", "premium", "bundle"];
  const currentIdx = tierOrder.indexOf(currentTier);

  return (
    <div className="py-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">구독 플랜</h1>
        <p className="text-sm text-[#8B95A5] mt-1">
          현재 등급:{" "}
          <Badge className={cn("border-0", currentTier === "free" ? "bg-[#8B95A5]/10 text-[#8B95A5]" : "bg-[#F5B800]/10 text-[#F5B800]")}>
            {currentTier.toUpperCase()}
          </Badge>
        </p>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-[#1A1D26] rounded-lg border border-[#2A2D36] p-1">
          {(["monthly", "quarterly", "yearly"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setBillingCycle(c)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                billingCycle === c
                  ? "bg-[#F5B800] text-[#0D0F14]"
                  : "text-[#8B95A5] hover:text-white"
              )}
            >
              {c === "monthly" ? "월간" : c === "quarterly" ? "분기" : "연간"}
              {c === "yearly" && <span className="ml-1 text-[10px]">BEST</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Referral Code */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <p className="text-sm text-white mb-2">운영자 추천코드 (선택)</p>
        <div className="flex gap-2">
          <Input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="6자리 코드 입력"
            maxLength={6}
            className="bg-[#22262F] border-[#2A2D36] text-white font-mono uppercase tracking-widest"
          />
          <Button
            onClick={handleReferralCheck}
            variant="outline"
            className="border-[#2A2D36] text-[#8B95A5] shrink-0"
          >
            확인
          </Button>
        </div>
        {referralPartner && (
          <p className="text-xs text-[#00E676] mt-2">
            {referralPartner} 운영자와 연결됩니다
          </p>
        )}
      </Card>

      {/* Plan Cards Grid */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {PLANS.filter(p => p.tier !== "free").map((plan) => {
          const prices = PLAN_PRICES[plan.tier];
          const price = prices?.[billingCycle] || 0;
          const monthlyEquiv = billingCycle === "monthly" ? price : billingCycle === "quarterly" ? Math.round(price / 3) : Math.round(price / 12);
          const discount = getDiscountPercent(plan.tier, billingCycle);
          const planIdx = tierOrder.indexOf(plan.tier);
          const isCurrent = plan.tier === currentTier;
          const isDowngrade = planIdx <= currentIdx && currentTier !== "free";
          const isFreeTrial = plan.freeTrial && currentTier === "free" && billingCycle === "monthly";

          return (
            <Card
              key={plan.tier}
              className={cn(
                "bg-[#1A1D26] border p-3 sm:p-4 transition-all relative flex flex-col",
                plan.tier === "bundle"
                  ? "border-[#F5B800]/50 shadow-[0_0_20px_rgba(245,184,0,0.1)]"
                  : `border-[${plan.color}]/30`
              )}
              style={{ borderColor: `${plan.color}30` }}
            >
              {/* Badges */}
              <div className="flex gap-2 mb-2 min-h-[24px]">
                {plan.popular && (
                  <Badge className="bg-[#F5B800] text-[#0D0F14] border-0 text-[10px]">
                    <Star className="w-3 h-3 mr-0.5" /> 인기
                  </Badge>
                )}
                {isFreeTrial && (
                  <Badge className="bg-[#00E676] text-[#0D0F14] border-0 text-[10px] font-bold animate-pulse">
                    첫 달 무료
                  </Badge>
                )}
                {discount && !isFreeTrial && (
                  <Badge className="bg-[#E040FB]/10 text-[#E040FB] border-0 text-[10px]">
                    {discount}% 할인
                  </Badge>
                )}
                {plan.tier === "bundle" && (
                  <Badge className="bg-[#F5B800] text-[#0D0F14] border-0 text-[10px]">
                    <Crown className="w-3 h-3 mr-0.5" /> VIP
                  </Badge>
                )}
              </div>

              {/* Name + Price */}
              <div className="mb-2">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-[#8B95A5]">{plan.desc}</p>
                <div className="mt-2">
                  {isFreeTrial ? (
                    <>
                      <span className="text-2xl font-bold text-[#00E676]">0</span>
                      <span className="text-xs text-[#8B95A5]">원/첫 달</span>
                      <p className="text-[10px] text-[#8B95A5]">
                        <span className="line-through">{formatPrice(prices?.monthly || 0)}원</span>
                        <span className="text-[#F5B800] ml-1">다음 달부터</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-xl sm:text-2xl font-bold text-white">{formatPrice(monthlyEquiv)}</span>
                      <span className="text-xs text-[#8B95A5]">원/월</span>
                      {billingCycle !== "monthly" && (
                        <p className="text-[10px] text-[#8B95A5]">
                          {billingCycle === "quarterly" ? "3개월" : "12개월"} 합계 {formatPrice(price)}원
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Frequency bar */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-[#8B95A5] mb-1">
                  <span>시그널 발행 주기</span>
                  <span className="font-bold" style={{ color: plan.color }}>{plan.frequency}</span>
                </div>
                <div className="h-1.5 bg-[#22262F] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${plan.frequencyBar}%`, backgroundColor: plan.color }}
                  />
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 mb-3 flex-1">
                {Object.entries(plan.features).map(([section, items]) =>
                  items.length > 0 ? (
                    <div key={section}>
                      {items.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-[#C0C0C0] py-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  ) : null
                )}
                {plan.locked.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#8B95A5]/40">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Button
                onClick={() => handleSubscribe(plan.tier, isFreeTrial ? 0 : price)}
                disabled={isCurrent || isDowngrade || subscribing === plan.tier}
                className={cn(
                  "w-full font-semibold h-11 text-xs sm:text-sm",
                  isCurrent
                    ? "bg-[#22262F] text-[#8B95A5] cursor-default"
                    : isFreeTrial
                      ? "bg-[#00E676] text-[#0D0F14] hover:bg-[#00E676]/90"
                      : plan.popular
                        ? "bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
                        : plan.tier === "bundle"
                          ? "bg-gradient-to-r from-[#F5B800] to-[#FF8F00] text-[#0D0F14] hover:opacity-90"
                          : "bg-[#22262F] text-white hover:bg-[#2A2D36]"
                )}
              >
                {subscribing === plan.tier && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isCurrent
                  ? "현재 구독중"
                  : isDowngrade
                    ? "다운그레이드 불가"
                    : isFreeTrial
                      ? "무료 시작"
                      : "구독하기"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table Toggle */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-[#8B95A5] hover:text-white transition-colors"
      >
        {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        상세 비교표 {showComparison ? "접기" : "보기"}
      </button>

      {/* Comparison Table */}
      {showComparison && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2A2D36]">
                <th className="text-left py-3 px-2 text-[#8B95A5] font-normal w-[120px]"></th>
                {["Free", "Basic", "Pro", "Premium", "VIP"].map((name, i) => (
                  <th key={name} className="py-3 px-2 text-center font-bold" style={{ color: PLANS[i].color }}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_SECTIONS.map((section) => (
                <>
                  <tr key={section.title}>
                    <td colSpan={6} className="pt-4 pb-2 px-2 text-[#F5B800] font-bold text-[11px]">
                      {section.title}
                    </td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr key={row.label} className="border-b border-[#1A1D26] hover:bg-[#1A1D26]/50">
                      <td className="py-2 px-2 text-[#8B95A5]">{row.label}</td>
                      {row.values.map((val, i) => (
                        <td key={i} className={cn(
                          "py-2 px-2 text-center",
                          val === "-" ? "text-[#555]" : val === "O" ? "text-[#00E676]" : "text-[#C0C0C0]"
                        )}>
                          {val === "O" ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676] mx-auto" /> : val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Partner Revenue Simulation */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-[#F5B800]" />
          <h3 className="text-sm font-bold text-white">파트너 수익 시뮬레이션</h3>
        </div>
        <p className="text-[11px] text-[#8B95A5] mb-4">
          파트너(리딩방 운영자)로 등록하면 구독자 수에 따라 수익을 분배받습니다
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { subs: 30, tier: "starter", rate: 80 },
            { subs: 100, tier: "pro", rate: 83 },
            { subs: 300, tier: "elite", rate: 85 },
            { subs: 700, tier: "legend", rate: 88 },
          ].map((s) => {
            const monthlyRev = s.subs * 99000 * (s.rate / 100);
            return (
              <div key={s.tier} className="bg-[#22262F] rounded-lg p-3 text-center">
                <p className="text-[10px] text-[#8B95A5]">{s.subs}명 구독</p>
                <p className="text-lg font-bold text-[#F5B800]">
                  {Math.round(monthlyRev / 10000).toLocaleString()}만원
                </p>
                <p className="text-[10px] text-[#8B95A5]">/월 (수수료 {s.rate}%)</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Footer */}
      <div className="p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <p className="text-[10px] text-[#8B95A5] leading-relaxed text-center">
          구독은 선택한 주기에 따라 자동 갱신됩니다. 언제든 해지 가능합니다.
          <br />결제 관련 문의: contact@moneysignal.io
        </p>
      </div>
    </div>
  );
}

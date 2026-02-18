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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriptionTier } from "@/types";

const plans = [
  {
    tier: "basic" as const,
    name: "Basic",
    price: 29900,
    priceLabel: "29,900원",
    freeTrial: true,
    freeTrialLabel: "첫 달 무료",
    features: [
      "코인 현물 시그널",
      "1일 3개 시그널",
      "30분 딜레이",
      "TP1 공개",
      "AI 분석 요약",
      "백테스트 30일",
    ],
    locked: ["코인 선물", "해외선물", "국내주식", "실시간 시그널"],
    color: "border-[#448AFF]/30",
    badge: "bg-[#448AFF]/10 text-[#448AFF]",
  },
  {
    tier: "pro" as const,
    name: "Pro",
    price: 59900,
    priceLabel: "59,900원",
    popular: true,
    freeTrial: true,
    freeTrialLabel: "첫 달 무료",
    features: [
      "코인 현물 + 선물 시그널",
      "1일 10개 시그널",
      "10분 딜레이",
      "TP1~2 공개",
      "보수적 레버리지",
      "AI 상세 분석",
      "AI 종목 질문 3회/일",
      "텔레그램 알림",
      "주간 리포트",
      "백테스트 180일",
    ],
    locked: ["해외선물", "국내주식", "실시간 시그널"],
    color: "border-[#F5B800]/30",
    badge: "bg-[#F5B800]/10 text-[#F5B800]",
  },
  {
    tier: "premium" as const,
    name: "Premium",
    price: 99900,
    priceLabel: "99,900원",
    features: [
      "전체 카테고리 시그널 (코인+선물+주식)",
      "무제한 시그널",
      "실시간 (딜레이 0)",
      "TP1~3 전체 공개",
      "보수적+공격적 레버리지",
      "AI 전체 분석 근거",
      "AI 종목 질문 10회/일",
      "텔레그램 알림",
      "주간 리포트 + 일일 브리핑",
      "백테스트 전체 이력",
      "CSV 다운로드",
      "수익률 고급 대시보드",
    ],
    locked: [],
    color: "border-[#E040FB]/30",
    badge: "bg-[#E040FB]/10 text-[#E040FB]",
  },
  {
    tier: "bundle" as const,
    name: "VIP Bundle",
    price: 149900,
    priceLabel: "149,900원",
    features: [
      "Premium 전체 기능 포함",
      "시그널 1시간 선공개",
      "AI 종목 질문 무제한",
      "VIP 전용 텔레그램 채널",
      "월간 종합 리포트",
      "1:1 상담 (월 2회)",
      "프리미엄 채팅방",
    ],
    locked: [],
    color: "border-[#F5B800]/50 shadow-[0_0_20px_rgba(245,184,0,0.1)]",
    badge: "bg-[#F5B800] text-[#0D0F14]",
  },
];

export default function SubscribePage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>("free");
  const [referralCode, setReferralCode] = useState("");
  const [referralPartner, setReferralPartner] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);

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

    // 무료 체험 (첫 달 무료)
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
        toast.success(`${tier.toUpperCase()} 무료 체험이 시작되었습니다! 🎉`);
        router.push("/app");
        return;
      } catch { toast.error("처리 중 오류"); } finally { setSubscribing(null); }
      return;
    }

    // 유료 결제: PortOne SDK
    try {
      const { default: PortOne } = await import("@portone/browser-sdk/v2");

      const orderId = `MS-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const tierNames: Record<string, string> = { basic: "Basic", pro: "Pro", premium: "Premium", bundle: "VIP Bundle" };

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "",
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "",
        paymentId: orderId,
        orderName: `머니시그널 ${tierNames[tier] || tier} 월간 구독`,
        totalAmount: price,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          customerId: currentTier,
        },
      });

      if (response?.code) {
        // 결제 실패 또는 취소
        if (response.code === "FAILURE_TYPE_PG") {
          toast.error("결제가 실패했습니다. 다시 시도해주세요.");
        } else {
          toast.error(response.message || "결제가 취소되었습니다.");
        }
        setSubscribing(null);
        return;
      }

      // 결제 성공 → 서버에서 검증
      toast.loading("결제 확인 중...");

      if (referralCode && referralPartner) {
        await fetch("/api/partner/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode }),
        });
      }

      const verifyRes = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: orderId,
          orderId,
          tier,
          amount: price,
          billingCycle: "monthly",
          referralCode: referralCode || null,
        }),
      });

      const verifyData = await verifyRes.json();
      toast.dismiss();

      if (!verifyRes.ok) {
        toast.error(verifyData.error || "결제 검증 실패");
        return;
      }

      toast.success(`${tierNames[tier] || tier} 구독이 시작되었습니다! 🎉`);
      router.push("/app");
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("결제 처리 중 오류가 발생했습니다");
    } finally {
      setSubscribing(null);
    }
  };

  const tierOrder = ["free", "basic", "pro", "premium", "bundle"];
  const currentIdx = tierOrder.indexOf(currentTier);

  return (
    <div className="py-4 space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">구독 플랜 선택</h1>
        <p className="text-sm text-[#8B95A5] mt-1">
          현재 등급:{" "}
          <Badge className={cn("border-0", currentTier === "free" ? "bg-[#8B95A5]/10 text-[#8B95A5]" : "bg-[#F5B800]/10 text-[#F5B800]")}>
            {currentTier.toUpperCase()}
          </Badge>
        </p>
      </div>

      {/* Referral Code Input */}
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
            ✅ {referralPartner} 운영자와 연결됩니다
          </p>
        )}
      </Card>

      {/* Plans */}
      <div className="space-y-4">
        {plans.map((plan) => {
          const planIdx = tierOrder.indexOf(plan.tier);
          const isCurrent = plan.tier === currentTier;
          const isDowngrade = planIdx <= currentIdx && currentTier !== "free";

          return (
            <Card
              key={plan.tier}
              className={cn(
                "bg-[#1A1D26] border p-5 transition-all",
                plan.color,
                plan.popular && "relative"
              )}
            >
              {plan.popular && !("freeTrial" in plan && plan.freeTrial) && (
                <Badge className="absolute -top-2 left-4 bg-[#F5B800] text-[#0D0F14] border-0 text-xs">
                  <Star className="w-3 h-3 mr-1" /> 인기
                </Badge>
              )}

              {/* Free trial + popular badges */}
              {"freeTrial" in plan && plan.freeTrial && (
                <div className="flex gap-2 mb-3">
                  <Badge className="bg-[#00E676] text-[#0D0F14] border-0 text-xs font-bold animate-pulse">
                    🎁 {("freeTrialLabel" in plan && plan.freeTrialLabel) || "첫 달 무료"}
                  </Badge>
                  {plan.popular && (
                    <Badge className="bg-[#F5B800] text-[#0D0F14] border-0 text-xs">
                      <Star className="w-3 h-3 mr-1" /> 인기
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                </div>
                <div className="text-right">
                  {"freeTrial" in plan && plan.freeTrial && currentTier === "free" ? (
                    <>
                      <span className="text-2xl font-bold text-[#00E676]">0원</span>
                      <span className="text-xs text-[#8B95A5] ml-1">/첫 달</span>
                      <p className="text-[10px] text-[#8B95A5]">
                        <span className="line-through">{plan.priceLabel}/월</span>
                        <span className="text-[#F5B800] ml-1">→ 다음 달부터 결제</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-white">
                        {plan.priceLabel}
                      </span>
                      <span className="text-xs text-[#8B95A5]">/월</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#8B95A5]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                    {f}
                  </div>
                ))}
                {plan.locked.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#8B95A5]/40">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleSubscribe(plan.tier, "freeTrial" in plan && plan.freeTrial && currentTier === "free" ? 0 : plan.price)}
                disabled={isCurrent || isDowngrade || subscribing === plan.tier}
                className={cn(
                  "w-full font-semibold h-11",
                  isCurrent
                    ? "bg-[#22262F] text-[#8B95A5] cursor-default"
                    : "freeTrial" in plan && plan.freeTrial && currentTier === "free"
                      ? "bg-[#00E676] text-[#0D0F14] hover:bg-[#00E676]/90"
                      : plan.popular
                        ? "bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
                        : "bg-[#22262F] text-white hover:bg-[#2A2D36]"
                )}
              >
                {subscribing === plan.tier ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isCurrent
                  ? "현재 구독중"
                  : isDowngrade
                    ? "다운그레이드 불가"
                    : "freeTrial" in plan && plan.freeTrial && currentTier === "free"
                      ? `🎁 ${plan.name} 무료로 시작하기`
                      : `${plan.name} 구독하기`}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <p className="text-[10px] text-[#8B95A5] leading-relaxed text-center">
          구독은 월 단위로 자동 갱신됩니다. 언제든 해지 가능합니다.
          <br />결제 관련 문의: contact@moneysignal.io
        </p>
      </div>
    </div>
  );
}

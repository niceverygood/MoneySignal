"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Crown,
  Star,
  Loader2,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriptionTier } from "@/types";
import { PLAN_PRICES } from "@/lib/portone";
import type { StoreKitProduct } from "@/lib/storekit";
import { IAP_PRODUCT_IDS, getAllProductIds, parseTierFromProductId } from "@/lib/storekit";

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
      analysis: ["내 종목 AI 진단 1일 1회 (무료 체험)"],
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
      vip: ["VIP 전용 텔레그램", "프리미엄 채팅방", "신규 기능 우선 체험"],
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
      { label: "내 종목 AI 진단", values: ["1회/일", "3회/일", "10회/일", "30회/일", "무제한"] },
      { label: "AI 종목 질문", values: ["-", "1회/일", "3회/일", "10회/일", "무제한"] },
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
      { label: "신규 기능 우선 체험", values: ["-", "-", "-", "-", "O"] },
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
  const [payMethod, setPayMethod] = useState<"card" | "kakaopay">("card");
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [displayName, setDisplayName] = useState<string>("사용자");
  const [isIOS, setIsIOS] = useState(false);
  const [iapProducts, setIapProducts] = useState<StoreKitProduct[]>([]);
  const [iapLoading, setIapLoading] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadIapProducts = async () => {
    setIapError(null);
    setIapLoading(true);
    try {
      const { default: StoreKit } = await import("@/lib/storekit");
      const productIds = getAllProductIds();
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await StoreKit.getProducts({ productIds });
          setIapProducts(res.products);
          if (res.products.length === 0) {
            setIapError(
              `구독 상품을 불러올 수 없습니다. (요청 ${res.requestedCount ?? productIds.length}개, 수신 0개)`
            );
          } else if (res.missingIds && res.missingIds.length > 0) {
            console.warn("StoreKit missing product IDs:", res.missingIds);
          }
          return;
        } catch (err) {
          lastErr = err;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      console.error("StoreKit products load error (all retries failed):", lastErr);
      setIapError(
        lastErr instanceof Error
          ? `구독 상품 로드 실패: ${lastErr.message}`
          : "구독 상품을 불러올 수 없습니다"
      );
    } finally {
      setIapLoading(false);
    }
  };

  useEffect(() => {
    import("@capacitor/core").then(async ({ Capacitor }) => {
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      setIsIOS(platform === "ios");

      if (isNative && platform === "ios") {
        await loadIapProducts();
      }
    });
    async function fetchTier() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier, display_name")
        .eq("id", user.id)
        .single();
      if (data) {
        setCurrentTier(data.subscription_tier as SubscriptionTier);
        if (data.display_name) setDisplayName(data.display_name);
      }
    }
    fetchTier();
  }, [supabase]);

  // iOS StoreKit IAP 결제
  const handleIAPSubscribe = async (tier: string) => {
    setSubscribing(tier);
    try {
      const iapProductId = IAP_PRODUCT_IDS[tier]?.[billingCycle];
      if (!iapProductId) {
        toast.error("해당 플랜은 현재 이용할 수 없습니다");
        return;
      }

      const { default: StoreKit } = await import("@/lib/storekit");
      const result = await StoreKit.purchase({ productId: iapProductId });

      if (result.cancelled) {
        toast.error("구매가 취소되었습니다");
        return;
      }
      if (result.pending) {
        toast.info("구매 승인 대기 중입니다");
        return;
      }
      if (!result.success) {
        toast.error("구매에 실패했습니다");
        return;
      }

      toast.loading("구독 처리 중...");

      // 서버에 트랜잭션 검증 + 구독 활성화 요청
      const verifyRes = await fetch("/api/iap/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: result.productId,
          transactionId: result.transactionId,
          originalTransactionId: result.originalTransactionId,
          purchaseDate: result.purchaseDate,
          expirationDate: result.expirationDate,
          jwsRepresentation: result.jwsRepresentation,
          tier,
          billingCycle,
        }),
      });

      const verifyData = await verifyRes.json();
      toast.dismiss();

      if (!verifyRes.ok) {
        toast.error(verifyData.error || "구독 처리 실패");
        return;
      }

      toast.success(`${tier.toUpperCase()} 구독이 시작되었습니다!`);
      router.push("/app");
    } catch (err) {
      console.error("IAP error:", err);
      toast.dismiss();
      toast.error("결제 처리 중 오류가 발생했습니다");
    } finally {
      setSubscribing(null);
    }
  };

  // 구매 복원 (iOS)
  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { default: StoreKit } = await import("@/lib/storekit");
      const { transactions } = await StoreKit.restorePurchases();

      if (transactions.length === 0) {
        toast.info("복원할 구독이 없습니다");
        return;
      }

      // 가장 최근 트랜잭션으로 구독 복원
      const latest = transactions[0];
      const parsed = parseTierFromProductId(latest.productId);
      if (!parsed) {
        toast.error("알 수 없는 상품입니다");
        return;
      }

      toast.loading("구독 복원 중...");
      const verifyRes = await fetch("/api/iap/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: latest.productId,
          transactionId: latest.transactionId,
          originalTransactionId: latest.originalTransactionId,
          purchaseDate: latest.purchaseDate,
          expirationDate: latest.expirationDate,
          tier: parsed.tier,
          billingCycle: parsed.billingCycle,
        }),
      });

      const data = await verifyRes.json();
      toast.dismiss();

      if (verifyRes.ok) {
        toast.success("구독이 복원되었습니다!");
        router.push("/app");
      } else {
        toast.error(data.error || "구독 복원 실패");
      }
    } catch (err) {
      console.error("Restore error:", err);
      toast.dismiss();
      toast.error("복원 중 오류가 발생했습니다");
    } finally {
      setRestoring(false);
    }
  };

  // 웹/Android PortOne 결제 (카드 / 카카오페이 정기결제 빌링키 발급)
  const handlePortOneSubscribe = async (
    tier: string,
    price: number,
    method: "card" | "kakaopay" = "card"
  ) => {
    try {
      const { default: PortOne } = await import("@portone/browser-sdk/v2");
      const tierNames: Record<string, string> = { basic: "Basic", pro: "Pro", premium: "Premium", bundle: "VIP Bundle" };
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "";
      const cardChannelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "";
      // 카카오페이 정기결제는 PortOne에 별도 카카오페이 채널이 필요합니다.
      // 전용 채널 키가 없으면 기본 채널로 폴백합니다.
      const kakaopayChannelKey =
        process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAOPAY || cardChannelKey;

      const customer = {
        customerId: authUser?.id || undefined,
        fullName: displayName,
        email: authUser?.email || undefined,
        phoneNumber: authUser?.phone || "01000000000",
      };
      const issueName = `머니시그널 ${tierNames[tier] || tier} 정기구독`;

      const response =
        method === "kakaopay"
          ? await PortOne.requestIssueBillingKey({
              storeId,
              channelKey: kakaopayChannelKey,
              billingKeyMethod: "EASY_PAY",
              easyPay: { easyPayProvider: "KAKAOPAY" },
              issueName,
              customer,
            })
          : await PortOne.requestIssueBillingKey({
              storeId,
              channelKey: cardChannelKey,
              billingKeyMethod: "CARD",
              issueName,
              customer,
            });

      if (response?.code) {
        console.error("PortOne response:", JSON.stringify(response));
        if (response.code === "FAILURE_TYPE_PG") {
          toast.error(`카드 등록 실패: ${response.message || "PG 오류"}`);
        } else {
          toast.error(response.message || "카드 등록이 취소되었습니다.");
        }
        setSubscribing(null);
        return;
      }

      if (!response?.billingKey) {
        toast.error("카드 등록에 실패했습니다.");
        setSubscribing(null);
        return;
      }

      toast.loading("결제 처리 중...");

      const issueRes = await fetch("/api/billing/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingKey: response.billingKey,
          tier,
          billingCycle,
          cardName: method === "kakaopay" ? "카카오페이" : null,
          cardNumberMasked: null,
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

  const handleSubscribe = async (tier: string, price: number) => {
    setSubscribing(tier);

    // iOS 네이티브 → Apple IAP
    if (isIOS) {
      await handleIAPSubscribe(tier);
      return;
    }

    // 웹/Android → PortOne (카드 / 카카오페이)
    await handlePortOneSubscribe(tier, price, payMethod);
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

      {/* 연간 선택 시 Premium·VIP는 월/분기만 제공됨을 안내 (조용히 사라지지 않게) */}
      {billingCycle === "yearly" && (
        <p className="text-center text-[10px] text-[#8B95A5] -mt-4">
          ※ Premium · VIP Bundle은 월간 · 분기 주기로 제공됩니다
        </p>
      )}

      {/* 결제 수단 선택 (웹/Android — iOS는 Apple 인앱결제 사용) */}
      {!isIOS && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex bg-[#1A1D26] rounded-lg border border-[#2A2D36] p-1">
            {([
              { key: "card", label: "카드" },
              { key: "kakaopay", label: "카카오페이" },
            ] as const).map((m) => (
              <button
                key={m.key}
                onClick={() => setPayMethod(m.key)}
                className={cn(
                  "px-5 py-2 rounded-md text-sm font-medium transition-all",
                  payMethod === m.key
                    ? m.key === "kakaopay"
                      ? "bg-[#FEE500] text-[#191600]"
                      : "bg-[#F5B800] text-[#0D0F14]"
                    : "text-[#8B95A5] hover:text-white"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#8B95A5]">
            {payMethod === "kakaopay"
              ? "카카오페이로 자동 정기결제됩니다"
              : "등록한 카드로 자동 정기결제됩니다"}
          </p>
        </div>
      )}

      {/* iOS 구매 복원 버튼 */}
      {isIOS && (
        <div className="flex justify-center">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="text-xs text-[#8B95A5] hover:text-white underline transition-colors"
          >
            {restoring ? "복원 중..." : "이전 구매 복원"}
          </button>
        </div>
      )}

      {/* IAP 로딩 상태 */}
      {isIOS && iapLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#F5B800] mr-2" />
          <span className="text-sm text-[#8B95A5]">구독 상품을 불러오는 중...</span>
        </div>
      )}

      {/* IAP 에러 + 재시도 */}
      {isIOS && !iapLoading && iapError && (
        <Card className="bg-[#1A1D26] border-red-500/30 p-4">
          <p className="text-sm text-red-400 mb-2">⚠️ {iapError}</p>
          <p className="text-xs text-[#8B95A5] mb-3">
            네트워크를 확인하거나 잠시 후 다시 시도해주세요. 계속 실패하면 재설치 후 시도해주세요.
          </p>
          <Button
            onClick={loadIapProducts}
            className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
          >
            다시 시도
          </Button>
        </Card>
      )}

      {/* Plan Cards Grid */}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
        {PLANS.filter(p => p.tier !== "free").filter((plan) => {
          const prices = PLAN_PRICES[plan.tier];
          // iOS에서도 IAP 상품 ID가 정의된 플랜은 항상 표시 (로드 실패해도)
          if (isIOS) {
            const iapId = IAP_PRODUCT_IDS[plan.tier]?.[billingCycle];
            return !!iapId;
          }
          return prices?.[billingCycle] != null;
        }).map((plan) => {
          const prices = PLAN_PRICES[plan.tier];
          const price = prices?.[billingCycle] || 0;

          // iOS에서는 App Store 실제 가격 표시
          const iapProduct = isIOS
            ? iapProducts.find(p => p.id === IAP_PRODUCT_IDS[plan.tier]?.[billingCycle])
            : null;
          const displayPrice = iapProduct ? iapProduct.price : price;

          const monthlyEquiv = billingCycle === "monthly" ? displayPrice : billingCycle === "quarterly" ? Math.round(displayPrice / 3) : Math.round(displayPrice / 12);
          const discount = getDiscountPercent(plan.tier, billingCycle);
          const planIdx = tierOrder.indexOf(plan.tier);
          const isCurrent = plan.tier === currentTier;
          const isDowngrade = planIdx <= currentIdx && currentTier !== "free";

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
              {/* Name + Badges */}
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="flex gap-1">
                    {plan.popular && (
                      <Badge className="bg-[#F5B800] text-[#0D0F14] border-0 text-[10px]">
                        <Star className="w-3 h-3 mr-0.5" /> 인기
                      </Badge>
                    )}
                    {discount && (
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
                </div>
                <p className="text-xs text-[#8B95A5]">{plan.desc}</p>
                <div className="mt-2">
                  {iapProduct ? (
                    <>
                      <span className="text-xl sm:text-2xl font-bold text-white">{iapProduct.displayPrice}</span>
                      <span className="text-xs text-[#8B95A5]">/{billingCycle === "monthly" ? "월" : billingCycle === "quarterly" ? "분기" : "연"}</span>
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
                onClick={() => handleSubscribe(plan.tier, price)}
                disabled={isCurrent || isDowngrade || subscribing === plan.tier || (isIOS && !iapProduct && !iapLoading)}
                className={cn(
                  "w-full font-semibold h-11 text-xs sm:text-sm",
                  isCurrent || (isIOS && !iapProduct && !iapLoading)
                    ? "bg-[#22262F] text-[#8B95A5] cursor-default"
                    : plan.popular
                      ? "bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
                      : plan.tier === "bundle"
                        ? "bg-gradient-to-r from-[#F5B800] to-[#FF8F00] text-[#0D0F14] hover:opacity-90"
                        : "bg-[#22262F] text-white hover:bg-[#2A2D36]"
                )}
              >
                {subscribing === plan.tier && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {iapLoading && isIOS
                  ? "불러오는 중..."
                  : isCurrent
                  ? "현재 구독중"
                  : isDowngrade
                    ? "다운그레이드 불가"
                    : isIOS && !iapProduct
                      ? "일시적으로 이용 불가"
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
                <Fragment key={section.title}>
                  <tr>
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
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subscription Info & Legal */}
      <div className="p-4 rounded-lg bg-[#1A1D26] border border-[#2A2D36] space-y-2">
        <p className="text-[11px] text-white font-semibold leading-relaxed">
          자동 갱신 구독 안내
        </p>
        <ul className="text-[10px] text-[#8B95A5] leading-relaxed space-y-1 list-disc list-inside">
          <li>구독 기간: 월간(1개월) / 분기(3개월) / 연간(12개월)</li>
          <li>구독은 선택한 주기에 따라 자동으로 갱신되며, 현재 구독 기간 종료 최소 24시간 전에 자동 갱신을 해제하지 않으면 동일 금액이 자동으로 청구됩니다.</li>
          {isIOS ? (
            <>
              <li>결제는 구매 확인 시 Apple ID 계정으로 청구됩니다.</li>
              <li>구독 관리 및 자동 갱신 해제는 iPhone 설정 &gt; Apple ID &gt; 구독에서 가능합니다.</li>
            </>
          ) : (
            <>
              <li>결제는 구매 확인 시 등록된 결제 수단으로 청구됩니다.</li>
              <li>구독 관리 및 자동 갱신 해제는 구매 후 계정 설정에서 가능합니다.</li>
            </>
          )}
        </ul>
        <div className="flex items-center gap-3 pt-1">
          <a href="/terms" className="text-[10px] text-[#F5B800] hover:underline">이용약관</a>
          <span className="text-[#2A2D36]">|</span>
          <a href="/privacy" className="text-[10px] text-[#F5B800] hover:underline">개인정보처리방침</a>
          <span className="text-[#2A2D36]">|</span>
          <a href="/disclaimer" className="text-[10px] text-[#F5B800] hover:underline">투자 주의사항</a>
        </div>
        <p className="text-[10px] text-[#8B95A5]">결제 관련 문의: contact@moneysignal.io</p>
      </div>
    </div>
  );
}

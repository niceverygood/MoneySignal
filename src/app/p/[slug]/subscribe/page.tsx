"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, Building2, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Product, Partner } from "@/types";
import { CATEGORY_LABELS } from "@/types";

type BillingCycle = "monthly" | "quarterly" | "yearly";

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0F14] flex items-center justify-center"><Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" /></div>}>
      <SubscribeForm />
    </Suspense>
  );
}

function SubscribeForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get("product");

  const [product, setProduct] = useState<Product | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      if (!productId) return;

      // Fetch partner
      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("brand_slug", params.slug)
        .single();

      if (partnerData) setPartner(partnerData as Partner);

      // Fetch product
      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productData) setProduct(productData as Product);
      setLoading(false);
    }

    fetchData();
  }, [productId, params.slug, supabase]);

  const getPrice = (): number => {
    if (!product) return 0;
    switch (billingCycle) {
      case "quarterly":
        return product.price_quarterly || product.price_monthly * 3;
      case "yearly":
        return product.price_yearly || product.price_monthly * 12;
      default:
        return product.price_monthly;
    }
  };

  const getDiscount = (): number => {
    if (!product) return 0;
    const monthlyTotal =
      billingCycle === "quarterly"
        ? product.price_monthly * 3
        : billingCycle === "yearly"
          ? product.price_monthly * 12
          : product.price_monthly;
    const actualPrice = getPrice();
    if (actualPrice >= monthlyTotal) return 0;
    return Math.round(((monthlyTotal - actualPrice) / monthlyTotal) * 100);
  };

  const handleSubscribe = async () => {
    if (!agreeTerms) {
      toast.error("이용약관에 동의해주세요");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/auth/login?redirectTo=/p/${params.slug}/subscribe?product=${productId}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          billingCycle,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("구독이 완료되었습니다!");
      router.push("/app");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "구독 처리에 실패했습니다"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0F14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
      </div>
    );
  }

  if (!product || !partner) {
    return (
      <div className="min-h-screen bg-[#0D0F14] flex items-center justify-center">
        <p className="text-[#8B95A5]">상품을 찾을 수 없습니다</p>
      </div>
    );
  }

  const price = getPrice();
  const discount = getDiscount();

  return (
    <div className="min-h-screen bg-[#0D0F14]">
      <header className="border-b border-[#2A2D36]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-[#8B95A5]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-white">구독 결제</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Product info */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white">{product.name}</h2>
            <Badge
              variant="outline"
              className="border-[#2A2D36] text-[#8B95A5] text-[10px]"
            >
              {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS]}
            </Badge>
          </div>
          <p className="text-sm text-[#8B95A5]">by {partner.brand_name}</p>
          {(product.features as string[])?.length > 0 && (
            <div className="mt-3 space-y-1">
              {(product.features as string[]).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#8B95A5]">
                  <CheckCircle2 className="w-3 h-3 text-[#00E676]" />
                  {f}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Billing cycle */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <h3 className="text-sm font-semibold text-white mb-3">결제 주기</h3>
          <div className="space-y-2">
            {(
              [
                { key: "monthly", label: "월간", price: product.price_monthly },
                ...(product.price_quarterly
                  ? [{ key: "quarterly", label: "분기", price: product.price_quarterly }]
                  : []),
                ...(product.price_yearly
                  ? [{ key: "yearly", label: "연간", price: product.price_yearly }]
                  : []),
              ] as { key: BillingCycle; label: string; price: number }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setBillingCycle(opt.key)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                  billingCycle === opt.key
                    ? "border-[#F5B800] bg-[#F5B800]/5"
                    : "border-[#2A2D36] hover:border-[#3A3D46]"
                )}
              >
                <span className="text-sm text-white">{opt.label}</span>
                <span className="text-sm font-bold text-white font-mono">
                  {opt.price.toLocaleString()}원
                </span>
              </button>
            ))}
          </div>
          {discount > 0 && (
            <p className="text-xs text-[#00E676] mt-2">
              월간 결제 대비 {discount}% 할인!
            </p>
          )}
        </Card>

        {/* Payment method */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <h3 className="text-sm font-semibold text-white mb-3">결제 수단</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethod("card")}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                paymentMethod === "card"
                  ? "border-[#F5B800] bg-[#F5B800]/5"
                  : "border-[#2A2D36]"
              )}
            >
              <CreditCard className="w-4 h-4 text-[#8B95A5]" />
              <span className="text-sm text-white">카드결제</span>
            </button>
            <button
              onClick={() => setPaymentMethod("bank")}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                paymentMethod === "bank"
                  ? "border-[#F5B800] bg-[#F5B800]/5"
                  : "border-[#2A2D36]"
              )}
            >
              <Building2 className="w-4 h-4 text-[#8B95A5]" />
              <span className="text-sm text-white">계좌이체</span>
            </button>
          </div>
        </Card>

        {/* Summary */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-[#8B95A5]">결제 금액</span>
            <span className="text-xl font-bold text-white font-mono">
              {price.toLocaleString()}원
            </span>
          </div>
          <p className="text-[10px] text-[#8B95A5]">
            자동 갱신 · 언제든 해지 가능
          </p>
        </Card>

        {/* Terms */}
        <div className="flex items-start gap-2.5">
          <Checkbox
            checked={agreeTerms}
            onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
            className="border-[#2A2D36] data-[state=checked]:bg-[#F5B800] data-[state=checked]:border-[#F5B800] mt-0.5"
          />
          <span className="text-xs text-[#8B95A5]">
            이용약관 및 구독 결제 정책에 동의합니다. 구독 기간 중 자동 갱신되며,
            해지는 만료일 전 언제든 가능합니다.
          </span>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubscribe}
          disabled={submitting || !agreeTerms}
          className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold h-12 text-base"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : null}
          {price.toLocaleString()}원 결제하기
        </Button>
      </main>
    </div>
  );
}

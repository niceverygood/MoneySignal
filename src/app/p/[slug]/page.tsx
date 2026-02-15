import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Crown,
  Users,
  TrendingUp,
  Shield,
  Lock,
  Star,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import type { Partner, Product, BacktestResult } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("brand_name, bio")
    .eq("brand_slug", slug)
    .eq("is_active", true)
    .single();

  if (!partner) return { title: "파트너를 찾을 수 없습니다" };

  return {
    title: `${partner.brand_name} - 머니시그널 파트너`,
    description: partner.bio || `${partner.brand_name}의 AI 시그널 서비스`,
  };
}

export default async function PartnerPublicPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("brand_slug", slug)
    .eq("is_active", true)
    .single();

  if (!partner) notFound();

  const p = partner as Partner;

  // Fetch products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("partner_id", p.id)
    .eq("is_active", true)
    .order("price_monthly", { ascending: true });

  // Fetch recent backtest data
  const { data: backtestData } = await supabase
    .from("backtest_results")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(4);

  // Fetch recent closed signals (blurred preview)
  const { data: recentSignals } = await supabase
    .from("signals")
    .select("id, symbol, symbol_name, direction, status, result_pnl_percent, category, created_at")
    .neq("status", "active")
    .order("closed_at", { ascending: false })
    .limit(5);

  const tierBadge: Record<string, string> = {
    starter: "bg-[#8B95A5]/10 text-[#8B95A5]",
    pro: "bg-[#448AFF]/10 text-[#448AFF]",
    elite: "bg-[#F5B800]/10 text-[#F5B800]",
    legend: "bg-[#E040FB]/10 text-[#E040FB]",
  };

  return (
    <div className="min-h-screen bg-[#0D0F14]">
      {/* Header */}
      <header className="border-b border-[#2A2D36] bg-[#0D0F14]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gold-gradient">
            MONEY SIGNAL
          </Link>
          <Link href="/auth/login">
            <Button
              variant="outline"
              size="sm"
              className="border-[#F5B800] text-[#F5B800] hover:bg-[#F5B800] hover:text-[#0D0F14]"
            >
              로그인
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Profile section */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D26] mx-auto mb-4 flex items-center justify-center overflow-hidden">
            {p.profile_image_url ? (
              <img
                src={p.profile_image_url}
                alt={p.brand_name}
                className="w-20 h-20 object-cover"
              />
            ) : (
              <Crown className="w-8 h-8 text-[#F5B800]" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{p.brand_name}</h1>
          <Badge className={`mt-2 ${tierBadge[p.tier] || tierBadge.starter} border-0`}>
            {p.tier.toUpperCase()} Partner
          </Badge>
          <div className="flex items-center justify-center gap-4 mt-3 text-sm text-[#8B95A5]">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              구독자 {p.subscriber_count}명
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              AI 시그널 제공
            </span>
          </div>
          {p.bio && (
            <p className="text-sm text-[#8B95A5] mt-4 max-w-md mx-auto">
              {p.bio}
            </p>
          )}
        </div>

        {/* Backtest preview */}
        {backtestData && backtestData.length > 0 && (
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#F5B800]" />
              <h3 className="text-sm font-semibold text-white">
                최근 30일 실적 미리보기
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(backtestData as BacktestResult[]).slice(0, 3).map((bt) => (
                <div key={bt.id} className="text-center">
                  <p className="text-[10px] text-[#8B95A5]">
                    {CATEGORY_LABELS[bt.category as keyof typeof CATEGORY_LABELS] || bt.category}
                  </p>
                  <p className="text-lg font-bold text-[#00E676]">
                    {Number(bt.win_rate).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-[#8B95A5]">승률</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent signals preview (blurred) */}
        {recentSignals && recentSignals.length > 0 && (
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              최근 시그널 결과
            </h3>
            <div className="space-y-2">
              {recentSignals.map((signal) => {
                const pnl = Number(signal.result_pnl_percent || 0);
                return (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-white">{signal.symbol_name}</span>
                    <Badge
                      className={
                        signal.direction === "long" || signal.direction === "buy"
                          ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                          : "bg-[#FF5252]/10 text-[#FF5252] border-0 text-[10px]"
                      }
                    >
                      {signal.direction.toUpperCase()}
                    </Badge>
                    <span
                      className={`font-mono font-bold ${
                        pnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
                      }`}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(1)}%
                    </span>
                    <span>{pnl > 0 ? "✅" : "❌"}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Products */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">구독 상품</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {(products as Product[] || []).map((product) => (
              <Card
                key={product.id}
                className="bg-[#1A1D26] border-[#2A2D36] p-5 hover:border-[#F5B800]/30 transition-all"
              >
                <h3 className="text-lg font-bold text-white mb-1">
                  {product.name}
                </h3>
                <Badge
                  variant="outline"
                  className="border-[#2A2D36] text-[#8B95A5] text-[10px] mb-3"
                >
                  {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS] ||
                    product.category}
                </Badge>

                {product.description && (
                  <p className="text-sm text-[#8B95A5] mb-3">
                    {product.description}
                  </p>
                )}

                {/* Features */}
                <div className="space-y-1.5 mb-4">
                  {(product.features as string[])?.map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-[#8B95A5]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" />
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-white">
                    월 {(product.price_monthly / 10000).toLocaleString()}만원
                  </span>
                  {product.price_quarterly && (
                    <span className="text-xs text-[#8B95A5]">
                      분기 {(product.price_quarterly / 10000).toLocaleString()}만원
                    </span>
                  )}
                </div>

                <Link
                  href={`/p/${slug}/subscribe?product=${product.id}`}
                >
                  <Button className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold">
                    <Lock className="w-4 h-4 mr-2" />
                    구독하기
                  </Button>
                </Link>
              </Card>
            ))}

            {(!products || products.length === 0) && (
              <p className="text-[#8B95A5] col-span-2 text-center py-8">
                아직 등록된 상품이 없습니다
              </p>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
          <p className="text-[10px] text-[#8B95A5] leading-relaxed">
            본 서비스는 투자 자문이 아니며, AI 분석 결과는 참고용입니다. 투자
            결정은 본인의 판단과 책임 하에 이루어져야 합니다. 과거 실적이 미래
            수익을 보장하지 않습니다.
          </p>
        </div>
      </main>
    </div>
  );
}

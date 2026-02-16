"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Crown,
  CreditCard,
  LogOut,
  ChevronRight,
  Shield,
  Star,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile, Subscription } from "@/types";
import { TIER_LABELS } from "@/types";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

export default function MyPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [perfSummary, setPerfSummary] = useState<{
    totalFollowed: number;
    winRate: number;
    avgPnl: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) setProfile(profileData as Profile);

      const { data: subsData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (subsData) setSubscriptions(subsData as Subscription[]);

      // Fetch performance summary
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch("/api/performance", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const perfData = await res.json();
            if (perfData.stats) {
              setPerfSummary({
                totalFollowed: perfData.stats.totalFollowed,
                winRate: perfData.stats.winRate,
                avgPnl: perfData.stats.avgPnl,
              });
            }
          }
        }
      } catch {
        // Performance data is optional
      }

      setLoading(false);
    }

    fetchData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tierColor = {
    free: "bg-[#8B95A5]/10 text-[#8B95A5]",
    basic: "bg-[#448AFF]/10 text-[#448AFF]",
    pro: "bg-[#F5B800]/10 text-[#F5B800]",
    premium: "bg-[#E040FB]/10 text-[#E040FB]",
    bundle: "bg-[#00E676]/10 text-[#00E676]",
  };

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-lg font-bold text-white">내 정보</h1>

      {/* Profile Card */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#2A2D36] flex items-center justify-center">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-[#8B95A5]" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">
              {profile?.display_name || "사용자"}
            </p>
            <p className="text-sm text-[#8B95A5]">{profile?.email}</p>
            <Badge
              className={cn(
                "mt-1 text-[10px] border-0",
                tierColor[profile?.subscription_tier || "free"]
              )}
            >
              <Crown className="w-3 h-3 mr-1" />
              {TIER_LABELS[profile?.subscription_tier || "free"]}
            </Badge>
          </div>
        </div>

        {profile?.subscription_expires_at && (
          <p className="text-xs text-[#8B95A5] mt-3 pt-3 border-t border-[#2A2D36]">
            구독 만료:{" "}
            {dayjs(profile.subscription_expires_at).format("YYYY.MM.DD")}
          </p>
        )}
      </Card>

      {/* Subscription upgrade */}
      <Card
        className="bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border-[#F5B800]/20 p-4 cursor-pointer hover:border-[#F5B800]/40 transition-all"
        onClick={() => router.push("/app/subscribe")}
      >
        <div className="flex items-center gap-3">
          <Star className="w-8 h-8 text-[#F5B800]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">
              {profile?.subscription_tier === "free"
                ? "구독 시작하기"
                : "구독 업그레이드"}
            </p>
            <p className="text-xs text-[#8B95A5]">
              {profile?.subscription_tier === "free"
                ? "AI 시그널을 확인하려면 구독하세요"
                : "더 많은 혜택을 받아보세요"}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#F5B800]" />
        </div>
      </Card>

      {/* Become Partner */}
      <Card
        className="bg-[#1A1D26] border-[#2A2D36] p-4 cursor-pointer hover:border-[#E040FB]/30 transition-all"
        onClick={() => router.push("/app/become-partner")}
      >
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-[#E040FB]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">운영자 신청하기</p>
            <p className="text-xs text-[#8B95A5]">
              유저를 모집하고 매출의 80%를 수익으로
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8B95A5]" />
        </div>
      </Card>

      {/* Performance Card */}
      <Card
        className="bg-[#1A1D26] border-[#2A2D36] p-4 cursor-pointer hover:bg-[#1E2130] transition-colors"
        onClick={() => router.push("/app/my/performance")}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F5B800]/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#F5B800]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">내 투자 성과</p>
            {perfSummary && perfSummary.totalFollowed > 0 ? (
              <p className="text-xs text-[#8B95A5] mt-0.5">
                팔로우 {perfSummary.totalFollowed}개, 승률{" "}
                {perfSummary.winRate.toFixed(1)}%, 예상 수익률{" "}
                <span
                  className={
                    perfSummary.avgPnl >= 0
                      ? "text-[#00E676]"
                      : "text-[#FF5252]"
                  }
                >
                  {perfSummary.avgPnl >= 0 ? "+" : ""}
                  {perfSummary.avgPnl.toFixed(2)}%
                </span>
              </p>
            ) : (
              <p className="text-xs text-[#8B95A5] mt-0.5">
                시그널을 팔로우하고 성과를 추적하세요
              </p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-[#8B95A5]" />
        </div>
      </Card>

      {/* Active Subscriptions */}
      <div>
        <h2 className="text-sm font-semibold text-[#8B95A5] mb-2 uppercase tracking-wider">
          활성 구독
        </h2>
        {subscriptions.filter((s) => s.status === "active").length === 0 ? (
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <p className="text-sm text-[#8B95A5] text-center">
              활성 구독이 없습니다
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {subscriptions
              .filter((s) => s.status === "active")
              .map((sub) => (
                <Card
                  key={sub.id}
                  className="bg-[#1A1D26] border-[#2A2D36] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {sub.billing_cycle === "monthly"
                          ? "월간"
                          : sub.billing_cycle === "quarterly"
                            ? "분기"
                            : "연간"}{" "}
                        구독
                      </p>
                      <p className="text-xs text-[#8B95A5]">
                        {dayjs(sub.current_period_end).format("YYYY.MM.DD")}{" "}
                        까지
                      </p>
                    </div>
                    <Badge className="bg-[#00E676]/10 text-[#00E676] border-0 text-xs">
                      활성
                    </Badge>
                  </div>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className="space-y-1">
        <MenuItem
          icon={CreditCard}
          label="결제 내역"
          onClick={() => {}}
        />
        <MenuItem
          icon={Shield}
          label="개인정보 처리방침"
          onClick={() => {}}
        />
        <MenuItem
          icon={LogOut}
          label="로그아웃"
          onClick={handleLogout}
          danger
        />
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
        danger
          ? "text-[#FF5252] hover:bg-[#FF5252]/5"
          : "text-[#8B95A5] hover:bg-[#1A1D26] hover:text-white"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm">{label}</span>
      <ChevronRight className="w-4 h-4 ml-auto" />
    </button>
  );
}

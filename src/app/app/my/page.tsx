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
  Check,
  Lock,
  Clock,
  Zap,
  BrainCircuit,
  BarChart3,
  FileText,
  MessageSquare,
  Send,
  Download,
  Bell,
  Pencil,
  Loader2,
  X as XIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Profile, Subscription } from "@/types";
import { TIER_LABELS } from "@/types";
import { TIER_CONFIG } from "@/lib/tier-access";
import type { TierKey } from "@/lib/tier-access";
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

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-lg font-bold text-white">내 정보</h1>

      {/* Profile Card */}
      <ProfileCard profile={profile} supabase={supabase} onUpdate={(name) => {
        if (profile) setProfile({ ...profile, display_name: name });
      }} />

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

      {/* Current Tier Services */}
      <TierServicesCard tier={(profile?.subscription_tier || "free") as TierKey} />

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

function ProfileCard({
  profile,
  supabase,
  onUpdate,
}: {
  profile: Profile | null;
  supabase: ReturnType<typeof createClient>;
  onUpdate: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newName.trim() || !profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: newName.trim() })
      .eq("id", profile.id);
    setSaving(false);
    if (!error) {
      onUpdate(newName.trim());
      setEditing(false);
      toast.success("닉네임이 변경되었습니다");
    } else {
      toast.error("변경에 실패했습니다");
    }
  };

  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#2A2D36] flex items-center justify-center">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-[#8B95A5]" />
          )}
        </div>
        <div className="flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={20}
                className="bg-[#22262F] border-[#2A2D36] text-white h-8 text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              />
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#F5B800] text-[#0D0F14] h-8 px-2">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "저장"}
              </Button>
              <button onClick={() => setEditing(false)} className="text-[#8B95A5]">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold">{profile?.display_name || "사용자"}</p>
              <button onClick={() => { setNewName(profile?.display_name || ""); setEditing(true); }} className="text-[#8B95A5] hover:text-[#F5B800]">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <p className="text-sm text-[#8B95A5]">{profile?.email}</p>
          <Badge className={cn("mt-1 text-[10px] border-0", tierColor[profile?.subscription_tier || "free"])}>
            <Crown className="w-3 h-3 mr-1" />
            {TIER_LABELS[profile?.subscription_tier || "free"]}
          </Badge>
        </div>
      </div>
      {profile?.subscription_expires_at && (
        <p className="text-xs text-[#8B95A5] mt-3 pt-3 border-t border-[#2A2D36]">
          구독 만료: {dayjs(profile.subscription_expires_at).format("YYYY.MM.DD")}
        </p>
      )}
    </Card>
  );
}

function TierServicesCard({ tier }: { tier: TierKey }) {
  const config = TIER_CONFIG[tier];
  const allTiers: TierKey[] = ["free", "basic", "pro", "premium", "bundle"];
  const currentIdx = allTiers.indexOf(tier);

  const services = [
    {
      icon: TrendingUp,
      label: "시그널 카테고리",
      value: config.categories.length === 0
        ? "없음 (결과만 공개)"
        : config.categories.length === 4
          ? "전체 (코인+선물+주식)"
          : config.categories.map((c: string) =>
              c === "coin_spot" ? "코인현물" :
              c === "coin_futures" ? "코인선물" :
              c === "overseas_futures" ? "해외선물" : "국내주식"
            ).join(", "),
      available: config.categories.length > 0,
      unlockAt: "basic",
    },
    {
      icon: Clock,
      label: "시그널 딜레이",
      value: config.delayMinutes === Infinity ? "-" :
             config.delayMinutes < 0 ? "1시간 선공개" :
             config.delayMinutes === 0 ? "실시간" :
             `${config.delayMinutes}분`,
      available: config.delayMinutes !== Infinity,
      unlockAt: "basic",
    },
    {
      icon: Zap,
      label: "일일 시그널 수",
      value: config.dailyLimit === 0 ? "0개" :
             config.dailyLimit === Infinity ? "무제한" :
             `${config.dailyLimit}개`,
      available: config.dailyLimit > 0,
      unlockAt: "basic",
    },
    {
      icon: BarChart3,
      label: "TP(익절) 공개",
      value: config.tpLevels === 0 ? "없음" : `TP1~${config.tpLevels}`,
      available: config.tpLevels > 0,
      unlockAt: "basic",
    },
    {
      icon: Shield,
      label: "레버리지 가이드",
      value: config.showLeverage === false ? "없음" :
             config.showLeverage === "conservative" ? "보수적만" : "보수적+공격적",
      available: config.showLeverage !== false,
      unlockAt: "pro",
    },
    {
      icon: BrainCircuit,
      label: "AI 분석 근거",
      value: config.aiReasoningDetail === "none" ? "없음" :
             config.aiReasoningDetail === "summary" ? "요약" :
             config.aiReasoningDetail === "detailed" ? "상세" : "전체",
      available: config.aiReasoningDetail !== "none",
      unlockAt: "basic",
    },
    {
      icon: MessageSquare,
      label: "AI 종목 질문",
      value: config.aiAskLimit === 0 ? "없음" :
             config.aiAskLimit === Infinity ? "무제한" :
             `${config.aiAskLimit}회/일`,
      available: config.aiAskLimit > 0,
      unlockAt: "pro",
    },
    {
      icon: Send,
      label: "텔레그램 알림",
      value: config.telegramEnabled ? "사용 가능" : "없음",
      available: config.telegramEnabled,
      unlockAt: "pro",
    },
    {
      icon: FileText,
      label: "주간 리포트",
      value: config.weeklyReport ? "사용 가능" : "없음",
      available: config.weeklyReport,
      unlockAt: "pro",
    },
    {
      icon: FileText,
      label: "일일 브리핑",
      value: config.dailyBriefing ? "사용 가능" : "없음",
      available: config.dailyBriefing,
      unlockAt: "premium",
    },
    {
      icon: BarChart3,
      label: "백테스트 기간",
      value: config.backtestPeriodDays === Infinity ? "전체 이력" :
             `최근 ${config.backtestPeriodDays}일`,
      available: true,
      unlockAt: "free",
    },
    {
      icon: Download,
      label: "CSV 다운로드",
      value: config.csvExport ? "사용 가능" : "없음",
      available: config.csvExport,
      unlockAt: "premium",
    },
    {
      icon: Bell,
      label: "앱 푸시 알림",
      value: config.pushNotification ? "사용 가능" : "없음",
      available: config.pushNotification,
      unlockAt: "basic",
    },
    {
      icon: Send,
      label: "SL(손절) 알림",
      value: config.slAlert ? "사용 가능" : "없음",
      available: config.slAlert,
      unlockAt: "pro",
    },
    {
      icon: FileText,
      label: "월간 종합 리포트",
      value: config.monthlyReport ? "사용 가능" : "없음",
      available: config.monthlyReport,
      unlockAt: "bundle",
    },
    {
      icon: Crown,
      label: "VIP 텔레그램 채널",
      value: config.vipChannel ? "사용 가능" : "없음",
      available: config.vipChannel,
      unlockAt: "bundle",
    },
    {
      icon: MessageSquare,
      label: "프리미엄 채팅방",
      value: config.premiumChat ? "사용 가능" : "없음",
      available: config.premiumChat,
      unlockAt: "bundle",
    },
    {
      icon: User,
      label: "1:1 파트너 상담",
      value: config.partnerConsulting > 0 ? `월 ${config.partnerConsulting}회 (30분)` : "없음",
      available: config.partnerConsulting > 0,
      unlockAt: "bundle",
    },
  ];

  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">내 서비스 현황</h2>
        <Badge className={cn("border-0 text-[10px]", tierColor[tier])}>
          {TIER_LABELS[tier]}
        </Badge>
      </div>

      <div className="space-y-2">
        {services.map((svc, i) => {
          const Icon = svc.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-2.5 py-1.5"
            >
              <div className={cn(
                "w-6 h-6 rounded flex items-center justify-center shrink-0",
                svc.available
                  ? "bg-[#00E676]/10"
                  : "bg-[#2A2D36]"
              )}>
                {svc.available ? (
                  <Check className="w-3.5 h-3.5 text-[#00E676]" />
                ) : (
                  <Lock className="w-3 h-3 text-[#8B95A5]/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", svc.available ? "text-[#8B95A5]" : "text-[#8B95A5]/30")} />
                  <span className={cn("text-xs", svc.available ? "text-[#8B95A5]" : "text-[#8B95A5]/30")}>
                    {svc.label}
                  </span>
                </div>
              </div>
              <span className={cn(
                "text-xs font-medium shrink-0",
                svc.available ? "text-white" : "text-[#8B95A5]/30"
              )}>
                {svc.available ? svc.value : `${svc.unlockAt.charAt(0).toUpperCase() + svc.unlockAt.slice(1)}부터`}
              </span>
            </div>
          );
        })}
      </div>

      {currentIdx < allTiers.length - 1 && (
        <Button
          onClick={() => window.location.href = "/app/subscribe"}
          className="w-full mt-3 bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold text-xs h-9"
        >
          더 많은 서비스 이용하기 →
        </Button>
      )}
    </Card>
  );
}

const tierColor: Record<string, string> = {
  free: "bg-[#8B95A5]/10 text-[#8B95A5]",
  basic: "bg-[#448AFF]/10 text-[#448AFF]",
  pro: "bg-[#F5B800]/10 text-[#F5B800]",
  premium: "bg-[#E040FB]/10 text-[#E040FB]",
  bundle: "bg-[#00E676]/10 text-[#00E676]",
};

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

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
  MessageCircle,
  BellRing,
  Smartphone,
  Send as SendIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

      // Fetch profile - try Supabase client first, then direct REST API
      let profileLoaded = false;

      // Method 1: Supabase client
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData?.role) {
        setProfile(profileData as Profile);
        profileLoaded = true;
      }

      // Method 2: Direct REST API with session token
      if (!profileLoaded) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const restRes = await fetch(
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=*&id=eq.${user.id}`,
              {
                headers: {
                  "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                  "Authorization": `Bearer ${session.access_token}`,
                },
              }
            );
            if (restRes.ok) {
              const restData = await restRes.json();
              if (restData[0]?.role) {
                setProfile(restData[0] as Profile);
                profileLoaded = true;
              }
            }
          }
        } catch { /* ignore */ }
      }

      // Method 3: Fallback
      if (!profileLoaded) {
        setProfile({
          id: user.id,
          email: user.email || "",
          display_name: user.user_metadata?.display_name || "사용자",
          avatar_url: null,
          role: "user",
          subscription_tier: "free",
          subscription_expires_at: null,
          referred_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Profile);
      }

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

      {/* 관리자 전용 바로가기 */}
      {profile?.role === "admin" && (
        <Card
          className="bg-gradient-to-r from-[#FF5252]/10 to-[#FF5252]/5 border-[#FF5252]/30 p-4 cursor-pointer hover:border-[#FF5252]/50 transition-all"
          onClick={() => router.push("/admin")}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF5252]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#FF5252]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">관리자 패널</p>
              <p className="text-xs text-[#8B95A5]">매출, 유저, 운영자, 시그널 전체 관리</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#FF5252]" />
          </div>
        </Card>
      )}

      {/* 운영자 전용 바로가기 */}
      {profile?.role === "partner" && (
        <Card
          className="bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border-[#F5B800]/30 p-4 cursor-pointer hover:border-[#F5B800]/50 transition-all"
          onClick={() => router.push("/partner/dashboard")}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F5B800]/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-[#F5B800]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">운영자 관리</p>
              <p className="text-xs text-[#8B95A5]">상품, 구독자, 수익, 출금 관리</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#F5B800]" />
          </div>
        </Card>
      )}

      {/* 정산 대시보드 (관리자/운영자만) */}
      {profile?.role === "admin" && <AdminSettlementDashboard supabase={supabase} />}
      {profile?.role === "partner" && <PartnerSettlementDashboard supabase={supabase} userId={profile.id} />}

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

      {/* Become Partner (일반 유저만) */}
      {profile?.role === "user" && (
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
      )}

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

      {/* 알림 설정 */}
      <NotificationSettings tier={(profile?.subscription_tier || "free") as TierKey} supabase={supabase} userId={profile?.id || ""} />

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

// ============================================
// 알림 설정
// ============================================
function NotificationSettings({
  tier,
  supabase,
  userId,
}: {
  tier: TierKey;
  supabase: ReturnType<typeof createClient>;
  userId: string;
}) {
  const [settings, setSettings] = useState({
    push_new_signal: true,
    push_tp_hit: true,
    push_sl_hit: true,
    kakao_new_signal: false,
    kakao_tp_hit: false,
    kakao_summary: false,
    telegram_enabled: false,
  });
  const router = useRouter();

  // Tier requirements
  // Push: Basic+, Kakao: Pro+, Telegram: Pro+
  const canPush = tier !== "free";
  const canKakao = tier === "pro" || tier === "premium" || tier === "bundle";
  const canTelegram = tier === "pro" || tier === "premium" || tier === "bundle";

  const toggleSetting = (key: string, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast.success(value ? "알림 켜짐" : "알림 꺼짐");
  };

  const notifications = [
    {
      section: "푸시 알림",
      icon: Smartphone,
      minTier: "basic" as const,
      enabled: canPush,
      items: [
        { key: "push_new_signal", label: "새 시그널 알림", desc: "AI 시그널 발행 시 즉시 알림" },
        { key: "push_tp_hit", label: "익절 도달 알림", desc: "TP1~TP3 도달 시 알림" },
        { key: "push_sl_hit", label: "손절 도달 알림", desc: "SL 도달 시 알림" },
      ],
    },
    {
      section: "카카오톡 알림",
      icon: MessageCircle,
      minTier: "pro" as const,
      enabled: canKakao,
      items: [
        { key: "kakao_new_signal", label: "새 시그널", desc: "카카오톡으로 시그널 수신" },
        { key: "kakao_tp_hit", label: "TP/SL 도달", desc: "익절·손절 도달 시 카카오 알림" },
        { key: "kakao_summary", label: "일일 요약", desc: "매일 22시 오늘의 성과 요약" },
      ],
    },
    {
      section: "텔레그램 알림",
      icon: SendIcon,
      minTier: "pro" as const,
      enabled: canTelegram,
      items: [
        { key: "telegram_enabled", label: "텔레그램 봇 연동", desc: "텔레그램으로 실시간 시그널 수신" },
      ],
    },
  ];

  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
      <div className="flex items-center gap-2 mb-4">
        <BellRing className="w-4 h-4 text-[#F5B800]" />
        <h2 className="text-sm font-semibold text-white">알림 설정</h2>
      </div>

      <div className="space-y-5">
        {notifications.map((section) => {
          const SectionIcon = section.icon;
          const isLocked = !section.enabled;

          return (
            <div key={section.section}>
              <div className="flex items-center gap-2 mb-2">
                <SectionIcon className={cn("w-4 h-4", isLocked ? "text-[#8B95A5]/30" : "text-[#8B95A5]")} />
                <span className={cn("text-xs font-medium", isLocked ? "text-[#8B95A5]/30" : "text-[#8B95A5]")}>
                  {section.section}
                </span>
                {isLocked && (
                  <Badge className="bg-[#22262F] text-[#8B95A5]/50 border-0 text-[8px] px-1.5 py-0">
                    <Lock className="w-2.5 h-2.5 mr-0.5" />
                    {section.minTier.charAt(0).toUpperCase() + section.minTier.slice(1)}부터
                  </Badge>
                )}
              </div>

              {isLocked ? (
                <div className="p-3 rounded-lg bg-[#22262F]/50 flex items-center justify-between">
                  <p className="text-[11px] text-[#8B95A5]/40">
                    {section.section}은 {section.minTier.charAt(0).toUpperCase() + section.minTier.slice(1)} 이상에서 이용 가능
                  </p>
                  <Button size="sm" onClick={() => router.push("/app/subscribe")}
                    className="bg-[#F5B800] text-[#0D0F14] text-[9px] h-6 px-2 hover:bg-[#FFD54F]">
                    업그레이드
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="text-sm text-white">{item.label}</p>
                        <p className="text-[10px] text-[#8B95A5]">{item.desc}</p>
                      </div>
                      {item.key === "telegram_enabled" ? (
                        <Button size="sm" variant="outline"
                          onClick={() => router.push("/app/my/telegram")}
                          className="border-[#2A2D36] text-[#8B95A5] text-[10px] h-7 px-2">
                          {settings.telegram_enabled ? "설정" : "연동하기"}
                        </Button>
                      ) : (
                        <Switch
                          checked={settings[item.key as keyof typeof settings] as boolean}
                          onCheckedChange={(checked) => toggleSetting(item.key, checked)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================
// 총괄관리자 정산 대시보드
// ============================================
function AdminSettlementDashboard({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [stats, setStats] = useState({
    totalRevenue: 0, platformRevenue: 0, partnerPayout: 0,
    pendingWithdrawals: 0, totalUsers: 0, paidUsers: 0,
    totalPartners: 0, monthlyRevenue: 0,
  });
  const [recentTx, setRecentTx] = useState<Array<{
    id: string; type: string; amount: number; description: string | null; created_at: string; status: string;
  }>>([]);
  const router = useRouter();

  useEffect(() => {
    async function fetch() {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      const [txRes, wdRes, usersRes, paidRes, partnersRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("status", "completed").order("created_at", { ascending: false }).limit(50),
        supabase.from("withdrawal_requests").select("amount").eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).neq("subscription_tier", "free"),
        supabase.from("partners").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      const allTx = txRes.data || [];
      const payments = allTx.filter((t) => t.type === "subscription_payment");
      const payouts = allTx.filter((t) => t.type === "partner_payout");
      const totalRev = payments.reduce((s, t) => s + t.amount, 0);
      const totalPayout = payouts.reduce((s, t) => s + t.amount, 0);
      const monthlyPayments = payments.filter((t) => new Date(t.created_at) >= monthStart);
      const monthlyRev = monthlyPayments.reduce((s, t) => s + t.amount, 0);
      const pendingWd = (wdRes.data || []).reduce((s, w) => s + w.amount, 0);

      setStats({
        totalRevenue: totalRev,
        platformRevenue: Math.round(totalRev * 0.2),
        partnerPayout: totalPayout,
        pendingWithdrawals: pendingWd,
        totalUsers: usersRes.count || 0,
        paidUsers: paidRes.count || 0,
        totalPartners: partnersRes.count || 0,
        monthlyRevenue: monthlyRev,
      });

      setRecentTx(allTx.slice(0, 5).map((t) => ({
        id: t.id, type: t.type, amount: t.amount,
        description: t.description, created_at: t.created_at, status: t.status,
      })));
    }
    fetch();
  }, [supabase]);

  const fmt = (n: number) => n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${n.toLocaleString()}원`;

  return (
    <Card className="bg-[#1A1D26] border-[#FF5252]/20 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FF5252]/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#FF5252]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">총괄관리자 정산</h2>
            <p className="text-[10px] text-[#8B95A5]">플랫폼 전체 수익 현황</p>
          </div>
        </div>
        <Button size="sm" onClick={() => router.push("/admin")} className="bg-[#FF5252] text-white hover:bg-[#FF5252]/80 text-[10px] h-7 px-2">
          관리자 패널 →
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#8B95A5] uppercase">총 매출</p>
          <p className="text-sm font-bold text-white font-mono">{fmt(stats.totalRevenue)}</p>
        </div>
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#00E676] uppercase">플랫폼 수익 (20%)</p>
          <p className="text-sm font-bold text-[#00E676] font-mono">{fmt(stats.platformRevenue)}</p>
        </div>
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#8B95A5] uppercase">이번달 매출</p>
          <p className="text-sm font-bold text-[#F5B800] font-mono">{fmt(stats.monthlyRevenue)}</p>
        </div>
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#8B95A5] uppercase">출금 대기</p>
          <p className="text-sm font-bold text-[#FF5252] font-mono">{fmt(stats.pendingWithdrawals)}</p>
        </div>
      </div>

      {/* User Stats */}
      <div className="flex justify-between text-xs text-[#8B95A5] py-2 border-t border-[#2A2D36]">
        <span>전체 유저 <strong className="text-white">{stats.totalUsers}</strong></span>
        <span>유료 <strong className="text-[#00E676]">{stats.paidUsers}</strong></span>
        <span>전환율 <strong className="text-[#F5B800]">{stats.totalUsers > 0 ? ((stats.paidUsers / stats.totalUsers) * 100).toFixed(1) : 0}%</strong></span>
        <span>운영자 <strong className="text-[#E040FB]">{stats.totalPartners}</strong></span>
      </div>

      {/* Recent Transactions */}
      {recentTx.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#2A2D36]">
          <p className="text-[10px] text-[#8B95A5] mb-1.5">최근 거래</p>
          {recentTx.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between text-[11px] py-1">
              <span className="text-[#8B95A5]">{dayjs(tx.created_at).format("MM.DD HH:mm")}</span>
              <span className="text-white truncate max-w-[120px]">{tx.description || tx.type}</span>
              <span className={tx.type === "partner_payout" ? "text-[#FF5252] font-mono" : "text-[#00E676] font-mono"}>
                {tx.type === "partner_payout" ? "-" : "+"}{tx.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================
// 운영자 정산 대시보드
// ============================================
function PartnerSettlementDashboard({ supabase, userId }: { supabase: ReturnType<typeof createClient>; userId: string }) {
  const [partner, setPartner] = useState<{
    brand_name: string; referral_code: string | null; tier: string;
    revenue_share_rate: number; total_revenue: number; total_withdrawn: number;
    available_balance: number; subscriber_count: number;
  } | null>(null);
  const [recentTx, setRecentTx] = useState<Array<{
    id: string; amount: number; description: string | null; created_at: string;
  }>>([]);
  const router = useRouter();

  useEffect(() => {
    async function fetch() {
      const { data: p } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (p) {
        setPartner(p);

        const { data: txData } = await supabase
          .from("transactions")
          .select("id, amount, description, created_at")
          .eq("partner_id", p.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(5);

        if (txData) setRecentTx(txData);
      }
    }
    fetch();
  }, [supabase, userId]);

  if (!partner) return null;

  const fmt = (n: number) => n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${n.toLocaleString()}원`;
  const sharePercent = Math.round(partner.revenue_share_rate * 100);

  return (
    <Card className="bg-[#1A1D26] border-[#F5B800]/20 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F5B800]/10 flex items-center justify-center">
            <Crown className="w-4 h-4 text-[#F5B800]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{partner.brand_name} 정산</h2>
            <p className="text-[10px] text-[#8B95A5]">{partner.tier.toUpperCase()} · 수수료 {sharePercent}%</p>
          </div>
        </div>
        <Button size="sm" onClick={() => router.push("/partner/dashboard")} className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] text-[10px] h-7 px-2">
          대시보드 →
        </Button>
      </div>

      {/* Referral Code */}
      {partner.referral_code && (
        <div className="flex items-center justify-between p-2.5 bg-[#22262F] rounded-lg mb-3">
          <div>
            <p className="text-[9px] text-[#8B95A5]">내 추천코드</p>
            <p className="text-lg font-bold text-[#F5B800] font-mono tracking-widest">{partner.referral_code}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => {
            navigator.clipboard.writeText(partner.referral_code || "");
            toast.success("복사됨!");
          }} className="text-[#8B95A5] hover:text-white text-xs">
            복사
          </Button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#8B95A5] uppercase">총 매출</p>
          <p className="text-sm font-bold text-white font-mono">{fmt(Number(partner.total_revenue))}</p>
        </div>
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#00E676] uppercase">내 수익 ({sharePercent}%)</p>
          <p className="text-sm font-bold text-[#00E676] font-mono">{fmt(Math.round(Number(partner.total_revenue) * partner.revenue_share_rate))}</p>
        </div>
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#8B95A5] uppercase">출금 완료</p>
          <p className="text-sm font-bold text-[#8B95A5] font-mono">{fmt(Number(partner.total_withdrawn))}</p>
        </div>
        <div className="bg-[#22262F] rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-[#F5B800] uppercase">출금 가능</p>
          <p className="text-sm font-bold text-[#F5B800] font-mono">{fmt(Number(partner.available_balance))}</p>
        </div>
      </div>

      {/* Subscriber Count */}
      <div className="flex items-center justify-between text-xs py-2 border-t border-[#2A2D36]">
        <span className="text-[#8B95A5]">내 구독자</span>
        <span className="text-white font-bold">{partner.subscriber_count}명</span>
      </div>

      {/* Recent Transactions */}
      {recentTx.length > 0 && (
        <div className="pt-2 border-t border-[#2A2D36]">
          <p className="text-[10px] text-[#8B95A5] mb-1.5">최근 정산</p>
          {recentTx.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between text-[11px] py-1">
              <span className="text-[#8B95A5]">{dayjs(tx.created_at).format("MM.DD")}</span>
              <span className="text-white truncate max-w-[150px]">{tx.description || "-"}</span>
              <span className="text-[#00E676] font-mono">+{tx.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-[#2A2D36]">
        <Button size="sm" onClick={() => router.push("/partner/withdraw")} variant="outline" className="flex-1 border-[#2A2D36] text-[#8B95A5] text-[10px] h-8">
          출금 신청
        </Button>
        <Button size="sm" onClick={() => router.push("/partner/subscribers")} variant="outline" className="flex-1 border-[#2A2D36] text-[#8B95A5] text-[10px] h-8">
          구독자 관리
        </Button>
      </div>
    </Card>
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

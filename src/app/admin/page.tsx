"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserCheck, DollarSign, TrendingUp, UserCog,
  Activity, Signal, Wallet, ArrowUpRight, ArrowDownRight,
  Crown, ChevronRight, BarChart3, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  status: string;
  user_id: string | null;
  partner_id: string | null;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  subscription_tier: string;
  created_at: string;
}

interface PartnerRow {
  id: string;
  brand_name: string;
  referral_code: string | null;
  tier: string;
  total_revenue: number;
  available_balance: number;
  subscriber_count: number;
  is_active: boolean;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const [txRes, userRes, partnerRes] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("partners").select("*").order("created_at", { ascending: false }),
      ]);
      if (txRes.data) setTransactions(txRes.data as Transaction[]);
      if (userRes.data) setUsers(userRes.data as UserRow[]);
      if (partnerRes.data) setPartners(partnerRes.data as PartnerRow[]);
      setLoading(false);
    }
    fetchAll();
  }, [supabase]);

  if (loading) {
    return <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  // Calculate stats
  const completedPayments = transactions.filter((t) => t.type === "subscription_payment" && t.status === "completed");
  const totalRevenue = completedPayments.reduce((s, t) => s + t.amount, 0);
  const platformRevenue = Math.round(totalRevenue * 0.2);
  const partnerRevenue = totalRevenue - platformRevenue;

  const today = dayjs().format("YYYY-MM-DD");
  const todayPayments = completedPayments.filter((t) => dayjs(t.created_at).format("YYYY-MM-DD") === today);
  const todayRevenue = todayPayments.reduce((s, t) => s + t.amount, 0);

  const thisMonth = dayjs().format("YYYY-MM");
  const monthlyPayments = completedPayments.filter((t) => dayjs(t.created_at).format("YYYY-MM") === thisMonth);
  const monthlyRevenue = monthlyPayments.reduce((s, t) => s + t.amount, 0);

  const pendingPartners = partners.filter((p) => !p.is_active);
  const activePartners = partners.filter((p) => p.is_active);
  const paidUsers = users.filter((u) => u.subscription_tier !== "free");
  const conversionRate = users.length > 0 ? (paidUsers.length / users.length) * 100 : 0;

  // Daily revenue for last 7 days
  const dailyRevenue: Array<{ date: string; amount: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
    const dayTotal = completedPayments
      .filter((t) => dayjs(t.created_at).format("YYYY-MM-DD") === date)
      .reduce((s, t) => s + t.amount, 0);
    dailyRevenue.push({ date, amount: dayTotal });
  }
  const maxDaily = Math.max(...dailyRevenue.map((d) => d.amount), 1);

  // Tier distribution
  const tierCounts: Record<string, number> = { free: 0, basic: 0, pro: 0, premium: 0, bundle: 0 };
  users.forEach((u) => { tierCounts[u.subscription_tier] = (tierCounts[u.subscription_tier] || 0) + 1; });

  const fmt = (n: number) => n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${n.toLocaleString()}원`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">관리자 대시보드</h1>
        <Badge className="bg-[#FF5252]/10 text-[#FF5252] border-0">
          <Activity className="w-3 h-3 mr-1" /> LIVE
        </Badge>
      </div>

      {/* === 매출 KPI === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="오늘 매출" value={fmt(todayRevenue)} icon={Calendar} color="text-[#F5B800]"
          sub={`${todayPayments.length}건`} />
        <KPICard label="이번달 매출" value={fmt(monthlyRevenue)} icon={BarChart3} color="text-[#00E676]"
          sub={`${monthlyPayments.length}건`} />
        <KPICard label="총 매출" value={fmt(totalRevenue)} icon={DollarSign} color="text-white"
          sub={`플랫폼 ${fmt(platformRevenue)}`} />
        <KPICard label="파트너 지급" value={fmt(partnerRevenue)} icon={Wallet} color="text-[#E040FB]"
          sub={`수수료 80%`} />
      </div>

      {/* === 일별 매출 차트 (최근 7일) === */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <h3 className="text-sm font-semibold text-[#8B95A5] mb-3 uppercase tracking-wider">
          일별 매출 (최근 7일)
        </h3>
        <div className="space-y-2">
          {dailyRevenue.map((d) => (
            <div key={d.date} className="flex items-center gap-3">
              <span className="text-xs text-[#8B95A5] w-12 shrink-0">
                {dayjs(d.date).format("M/DD")}
              </span>
              <div className="flex-1 h-6 bg-[#22262F] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F5B800] to-[#FFD54F] transition-all"
                  style={{ width: `${(d.amount / maxDaily) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white font-mono w-20 text-right">
                {d.amount > 0 ? fmt(d.amount) : "-"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* === 유저 현황 === */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#448AFF]" /> 유저 현황
            </h3>
            <Button size="sm" variant="ghost" onClick={() => router.push("/admin/users")} className="text-[#8B95A5] text-[10px] h-7">
              전체보기 <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>

          {/* Tier distribution */}
          <div className="grid grid-cols-5 gap-1 mb-3">
            {(["free", "basic", "pro", "premium", "bundle"] as const).map((tier) => {
              const colors: Record<string, string> = {
                free: "bg-[#8B95A5]", basic: "bg-[#448AFF]", pro: "bg-[#F5B800]",
                premium: "bg-[#E040FB]", bundle: "bg-[#00E676]",
              };
              return (
                <div key={tier} className="text-center">
                  <div className="h-12 flex items-end justify-center mb-1">
                    <div
                      className={cn("w-full rounded-t", colors[tier])}
                      style={{ height: `${Math.max(4, (tierCounts[tier] / Math.max(users.length, 1)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-[#8B95A5] uppercase">{tier}</p>
                  <p className="text-xs font-bold text-white">{tierCounts[tier]}</p>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-[#8B95A5] pt-2 border-t border-[#2A2D36]">
            <span>전체 <strong className="text-white">{users.length}</strong></span>
            <span>유료 <strong className="text-[#00E676]">{paidUsers.length}</strong></span>
            <span>전환율 <strong className="text-[#F5B800]">{conversionRate.toFixed(1)}%</strong></span>
          </div>

          {/* Recent signups */}
          <div className="mt-3 pt-2 border-t border-[#2A2D36]">
            <p className="text-[10px] text-[#8B95A5] mb-1">최근 가입</p>
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between text-[11px] py-1">
                <span className="text-white truncate max-w-[120px]">{u.display_name}</span>
                <Badge className={cn("text-[8px] border-0 px-1 py-0",
                  u.role === "admin" ? "bg-[#FF5252]/10 text-[#FF5252]" :
                  u.role === "partner" ? "bg-[#F5B800]/10 text-[#F5B800]" :
                  "bg-[#22262F] text-[#8B95A5]"
                )}>
                  {u.subscription_tier}
                </Badge>
                <span className="text-[#8B95A5]">{dayjs(u.created_at).format("MM.DD")}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* === 운영자 현황 === */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#F5B800]" /> 운영자 현황
            </h3>
            <Button size="sm" variant="ghost" onClick={() => router.push("/admin/partners")} className="text-[#8B95A5] text-[10px] h-7">
              전체보기 <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>

          {/* Pending approvals */}
          {pendingPartners.length > 0 && (
            <div className="p-2.5 rounded-lg bg-[#F5B800]/5 border border-[#F5B800]/20 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#F5B800] font-bold">승인 대기 {pendingPartners.length}건</span>
                <Button size="sm" onClick={() => router.push("/admin/partners")}
                  className="bg-[#F5B800] text-[#0D0F14] text-[10px] h-6 px-2">
                  처리하기
                </Button>
              </div>
            </div>
          )}

          {/* Active partners list */}
          <div className="space-y-2">
            {activePartners.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-[#22262F] rounded-lg p-2">
                <div>
                  <span className="text-white font-medium">{p.brand_name}</span>
                  {p.referral_code && (
                    <span className="text-[#F5B800] font-mono text-[10px] ml-1.5">{p.referral_code}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-[#8B95A5]">{p.subscriber_count}명</span>
                  <span className="text-[#00E676] font-mono">{fmt(Number(p.total_revenue))}</span>
                </div>
              </div>
            ))}
            {activePartners.length === 0 && (
              <p className="text-xs text-[#8B95A5] text-center py-4">활성 운영자 없음</p>
            )}
          </div>

          <div className="flex justify-between text-xs text-[#8B95A5] mt-3 pt-2 border-t border-[#2A2D36]">
            <span>활성 <strong className="text-[#00E676]">{activePartners.length}</strong></span>
            <span>대기 <strong className="text-[#F5B800]">{pendingPartners.length}</strong></span>
            <span>총 구독자 <strong className="text-white">{activePartners.reduce((s, p) => s + p.subscriber_count, 0)}</strong></span>
          </div>
        </Card>
      </div>

      {/* === 최근 거래 내역 === */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#00E676]" /> 최근 거래 내역
          </h3>
          <Button size="sm" variant="ghost" onClick={() => router.push("/admin/revenue")} className="text-[#8B95A5] text-[10px] h-7">
            전체보기 <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-[70px_1fr_80px_50px] gap-2 text-[10px] text-[#8B95A5] pb-2 border-b border-[#2A2D36]">
            <span>날짜</span><span>내역</span><span className="text-right">금액</span><span className="text-center">상태</span>
          </div>
          {transactions.slice(0, 10).map((tx) => (
            <div key={tx.id} className="grid grid-cols-[70px_1fr_80px_50px] gap-2 text-xs py-2 border-b border-[#2A2D36]/30 items-center">
              <span className="text-[#8B95A5]">{dayjs(tx.created_at).format("MM.DD HH:mm")}</span>
              <span className="text-white truncate">{tx.description || tx.type}</span>
              <span className={cn("text-right font-mono",
                tx.type === "partner_payout" ? "text-[#FF5252]" : "text-[#00E676]"
              )}>
                {tx.type === "partner_payout" ? "-" : "+"}{tx.amount.toLocaleString()}
              </span>
              <Badge className={cn("text-[8px] border-0 justify-center",
                tx.status === "completed" ? "bg-[#00E676]/10 text-[#00E676]" : "bg-[#F5B800]/10 text-[#F5B800]"
              )}>
                {tx.status === "completed" ? "완료" : tx.status}
              </Badge>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-xs text-[#8B95A5] text-center py-4">거래 내역 없음</p>
          )}
        </div>
      </Card>

      {/* === 빠른 메뉴 === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink label="운영자 승인" count={pendingPartners.length} icon={UserCog} color="text-[#F5B800]"
          onClick={() => router.push("/admin/partners")} />
        <QuickLink label="출금 처리" icon={Wallet} color="text-[#E040FB]"
          onClick={() => router.push("/admin/withdrawals")} />
        <QuickLink label="시그널 관리" icon={Signal} color="text-[#00E676]"
          onClick={() => router.push("/admin/signals")} />
        <QuickLink label="유저 관리" icon={Users} color="text-[#448AFF]"
          onClick={() => router.push("/admin/users")} />
      </div>
    </div>
  );
}

function KPICard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>;
  color: string; sub?: string;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[9px] text-[#8B95A5] uppercase">{label}</span>
      </div>
      <p className={cn("text-lg font-bold font-mono", color)}>{value}</p>
      {sub && <p className="text-[10px] text-[#8B95A5]">{sub}</p>}
    </Card>
  );
}

function QuickLink({ label, count, icon: Icon, color, onClick }: {
  label: string; count?: number; icon: React.ComponentType<{ className?: string }>;
  color: string; onClick: () => void;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 cursor-pointer hover:border-[#3A3D46] transition-all" onClick={onClick}>
      <div className="flex items-center justify-between">
        <Icon className={cn("w-5 h-5", color)} />
        {count !== undefined && count > 0 && (
          <Badge className="bg-[#FF5252] text-white border-0 text-[9px] px-1.5 py-0">{count}</Badge>
        )}
      </div>
      <p className="text-xs text-white mt-2 font-medium">{label}</p>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Users,
  UserCheck,
  DollarSign,
  TrendingUp,
  UserCog,
  Activity,
  CreditCard,
  Signal,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  paidUsers: number;
  conversionRate: number;
  totalPartners: number;
  activePartners: number;
  monthlyRevenue: number;
  platformRevenue: number;
  activeSignals: number;
  todaySignals: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    paidUsers: 0,
    conversionRate: 0,
    totalPartners: 0,
    activePartners: 0,
    monthlyRevenue: 0,
    platformRevenue: 0,
    activeSignals: 0,
    todaySignals: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      // Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Paid users
      const { count: paidUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .neq("subscription_tier", "free");

      // Partners
      const { count: totalPartners } = await supabase
        .from("partners")
        .select("*", { count: "exact", head: true });

      const { count: activePartners } = await supabase
        .from("partners")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Monthly revenue
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyTx } = await supabase
        .from("transactions")
        .select("amount, partner_share, platform_share")
        .eq("type", "subscription_payment")
        .eq("status", "completed")
        .gte("created_at", startOfMonth.toISOString());

      const monthlyRevenue = (monthlyTx || []).reduce((sum, tx) => sum + tx.amount, 0);
      const platformRevenue = (monthlyTx || []).reduce(
        (sum, tx) => sum + (tx.platform_share || 0),
        0
      );

      // Active signals
      const { count: activeSignals } = await supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Today signals
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todaySignals } = await supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());

      const total = totalUsers || 0;
      const paid = paidUsers || 0;

      setStats({
        totalUsers: total,
        paidUsers: paid,
        conversionRate: total > 0 ? (paid / total) * 100 : 0,
        totalPartners: totalPartners || 0,
        activePartners: activePartners || 0,
        monthlyRevenue,
        platformRevenue,
        activeSignals: activeSignals || 0,
        todaySignals: todaySignals || 0,
      });

      setLoading(false);
    }

    fetchStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">관리자 대시보드</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="총 유저"
          value={stats.totalUsers.toLocaleString()}
          subValue={`유료 ${stats.paidUsers}명 (${stats.conversionRate.toFixed(1)}%)`}
          icon={Users}
          color="text-[#448AFF]"
        />
        <KPICard
          label="파트너"
          value={`${stats.activePartners} / ${stats.totalPartners}`}
          subValue="활성 / 전체"
          icon={UserCog}
          color="text-[#E040FB]"
        />
        <KPICard
          label="이번달 매출"
          value={`${Math.round(stats.monthlyRevenue / 10000).toLocaleString()}만원`}
          subValue={`플랫폼 ${Math.round(stats.platformRevenue / 10000).toLocaleString()}만원`}
          icon={DollarSign}
          color="text-[#00E676]"
        />
        <KPICard
          label="시그널"
          value={stats.activeSignals.toString()}
          subValue={`오늘 ${stats.todaySignals}개 발행`}
          icon={Signal}
          color="text-[#F5B800]"
        />
      </div>

      {/* Quick stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#FF5252]" />
            핵심 지표
          </h3>
          <div className="space-y-3">
            <StatRow label="전환율 (무료→유료)" value={`${stats.conversionRate.toFixed(1)}%`} />
            <StatRow label="ARPU" value={stats.paidUsers > 0 ? `${Math.round(stats.monthlyRevenue / stats.paidUsers).toLocaleString()}원` : "N/A"} />
            <StatRow label="플랫폼 마진" value={`${Math.round(stats.platformRevenue / 10000).toLocaleString()}만원`} />
          </div>
        </Card>

        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#00E676]" />
            매출 분배
          </h3>
          <div className="space-y-3">
            <StatRow label="총 매출" value={`${stats.monthlyRevenue.toLocaleString()}원`} />
            <StatRow label="파트너 몫 (~80%)" value={`${(stats.monthlyRevenue - stats.platformRevenue).toLocaleString()}원`} />
            <StatRow label="플랫폼 몫 (~20%)" value={`${stats.platformRevenue.toLocaleString()}원`} highlight />
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subValue: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] text-[#8B95A5] uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold text-white font-mono">{value}</p>
      <p className="text-[10px] text-[#8B95A5] mt-1">{subValue}</p>
    </Card>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#8B95A5]">{label}</span>
      <span className={highlight ? "text-[#00E676] font-bold font-mono" : "text-white font-mono"}>
        {value}
      </span>
    </div>
  );
}

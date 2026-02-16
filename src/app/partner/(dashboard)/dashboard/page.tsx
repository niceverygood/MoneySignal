"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  DollarSign,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import type { Partner, Subscription, Transaction } from "@/types";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

export default function PartnerDashboardPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [recentSubs, setRecentSubs] = useState<Subscription[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get partner data
      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (partnerData) {
        setPartner(partnerData as Partner);

        // Get recent subscriptions
        const { data: subsData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("partner_id", partnerData.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (subsData) setRecentSubs(subsData as Subscription[]);

        // Get recent transactions
        const { data: transData } = await supabase
          .from("transactions")
          .select("*")
          .eq("partner_id", partnerData.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (transData) setRecentTransactions(transData as Transaction[]);
      }

      setLoading(false);
    }

    fetchData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-20">
        <p className="text-[#8B95A5]">파트너 정보를 찾을 수 없습니다</p>
      </div>
    );
  }

  const sharePercent = Math.round(partner.revenue_share_rate * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-sm text-[#8B95A5]">
          {partner.brand_name} · {partner.tier.toUpperCase()}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="총 구독자"
          value={partner.subscriber_count.toLocaleString() + "명"}
          icon={Users}
          subtext="+0 이번주"
          color="text-[#448AFF]"
        />
        <KPICard
          label="이번달 매출"
          value={formatKRW(Number(partner.total_revenue))}
          icon={DollarSign}
          subtext="전월 대비"
          color="text-[#00E676]"
        />
        <KPICard
          label="내 수익"
          value={formatKRW(Math.round(Number(partner.total_revenue) * partner.revenue_share_rate))}
          icon={TrendingUp}
          subtext={`(${sharePercent}%)`}
          color="text-[#F5B800]"
        />
        <KPICard
          label="출금 가능"
          value={formatKRW(Number(partner.available_balance))}
          icon={Wallet}
          action={
            <Link href="/partner/withdraw">
              <Button
                size="sm"
                className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] text-[10px] h-6 px-2"
              >
                출금하기
              </Button>
            </Link>
          }
          color="text-[#E040FB]"
        />
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent subscriptions */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">최근 구독</h3>
            <Link
              href="/partner/subscribers"
              className="text-xs text-[#F5B800] hover:underline"
            >
              전체보기
            </Link>
          </div>
          {recentSubs.length === 0 ? (
            <p className="text-sm text-[#8B95A5] text-center py-4">
              아직 구독자가 없습니다
            </p>
          ) : (
            <div className="space-y-3">
              {recentSubs.slice(0, 5).map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    {sub.status === "active" ? (
                      <ArrowUpRight className="w-4 h-4 text-[#00E676]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-[#FF5252]" />
                    )}
                    <span className="text-[#8B95A5]">
                      {dayjs(sub.created_at).format("MM.DD")}
                    </span>
                  </div>
                  <span className="text-white font-mono">
                    {sub.amount_paid.toLocaleString()}원
                  </span>
                  <Badge
                    className={
                      sub.status === "active"
                        ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                        : "bg-[#FF5252]/10 text-[#FF5252] border-0 text-[10px]"
                    }
                  >
                    {sub.status === "active" ? "구독" : sub.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent transactions */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">최근 정산</h3>
            <Link
              href="/partner/revenue"
              className="text-xs text-[#F5B800] hover:underline"
            >
              전체보기
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-[#8B95A5] text-center py-4">
              정산 내역이 없습니다
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[#8B95A5]">
                    {dayjs(tx.created_at).format("MM.DD")}
                  </span>
                  <span className="text-white truncate max-w-[150px]">
                    {tx.description || tx.type}
                  </span>
                  <span className="text-[#00E676] font-mono">
                    +{tx.amount.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Partner tier info */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <h3 className="text-sm font-semibold text-white mb-3">파트너 등급</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { tier: "Starter", range: "0~50명", rate: "80%" },
            { tier: "Pro", range: "51~200명", rate: "83%" },
            { tier: "Elite", range: "201~500명", rate: "85%" },
            { tier: "Legend", range: "501명+", rate: "88%" },
          ].map((t) => (
            <div
              key={t.tier}
              className={`p-3 rounded-lg text-center ${
                partner.tier === t.tier.toLowerCase()
                  ? "bg-[#F5B800]/10 border border-[#F5B800]/30"
                  : "bg-[#22262F]"
              }`}
            >
              <p
                className={`text-xs font-bold ${
                  partner.tier === t.tier.toLowerCase()
                    ? "text-[#F5B800]"
                    : "text-[#8B95A5]"
                }`}
              >
                {t.tier}
              </p>
              <p className="text-[10px] text-[#8B95A5] mt-1">{t.range}</p>
              <p className="text-sm font-bold text-white mt-1">{t.rate}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon: Icon,
  subtext,
  action,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtext?: string;
  action?: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] text-[#8B95A5] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-lg font-bold text-white font-mono">{value}</p>
      {subtext && (
        <p className="text-[10px] text-[#8B95A5] mt-1">{subtext}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}

function formatKRW(amount: number): string {
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

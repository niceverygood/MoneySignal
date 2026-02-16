"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Wallet, PiggyBank } from "lucide-react";
import type { Partner, Transaction } from "@/types";
import dayjs from "dayjs";

export default function RevenuePage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (partnerData) {
        setPartner(partnerData as Partner);

        const { data: txData } = await supabase
          .from("transactions")
          .select("*")
          .eq("partner_id", partnerData.id)
          .order("created_at", { ascending: false });

        if (txData) setTransactions(txData as Transaction[]);
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">수익 / 정산</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="총 매출"
          value={`${Number(partner?.total_revenue || 0).toLocaleString()}원`}
          icon={DollarSign}
          color="text-[#00E676]"
        />
        <SummaryCard
          label="내 수익"
          value={`${Math.round(Number(partner?.total_revenue || 0) * (partner?.revenue_share_rate || 0.8)).toLocaleString()}원`}
          icon={TrendingUp}
          color="text-[#F5B800]"
        />
        <SummaryCard
          label="총 출금"
          value={`${Number(partner?.total_withdrawn || 0).toLocaleString()}원`}
          icon={PiggyBank}
          color="text-[#448AFF]"
        />
        <SummaryCard
          label="출금 가능"
          value={`${Number(partner?.available_balance || 0).toLocaleString()}원`}
          icon={Wallet}
          color="text-[#E040FB]"
        />
      </div>

      {/* Transactions table */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden">
        <div className="p-4 border-b border-[#2A2D36]">
          <h3 className="text-sm font-semibold text-white">정산 내역</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2D36]">
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">날짜</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">유형</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">설명</th>
                <th className="text-right text-[10px] text-[#8B95A5] uppercase p-3">금액</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-[#8B95A5]">
                    정산 내역이 없습니다
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-[#2A2D36]/50 hover:bg-[#22262F]"
                  >
                    <td className="p-3 text-sm text-[#8B95A5]">
                      {dayjs(tx.created_at).format("YY.MM.DD")}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className="border-[#2A2D36] text-[#8B95A5] text-[10px]"
                      >
                        {tx.type === "subscription_payment"
                          ? "구독 결제"
                          : tx.type === "partner_payout"
                            ? "출금"
                            : "환불"}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-white">
                      {tx.description || "-"}
                    </td>
                    <td className="p-3 text-sm text-right font-mono">
                      <span
                        className={
                          tx.type === "partner_payout"
                            ? "text-[#FF5252]"
                            : "text-[#00E676]"
                        }
                      >
                        {tx.type === "partner_payout" ? "-" : "+"}
                        {tx.amount.toLocaleString()}원
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge
                        className={
                          tx.status === "completed"
                            ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                            : "bg-[#F5B800]/10 text-[#F5B800] border-0 text-[10px]"
                        }
                      >
                        {tx.status === "completed" ? "완료" : tx.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] text-[#8B95A5] uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold text-white font-mono">{value}</p>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, PiggyBank } from "lucide-react";
import type { Transaction } from "@/types";
import dayjs from "dayjs";

export default function AdminRevenuePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [platformRevenue, setPlatformRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (data) {
        const txs = data as Transaction[];
        setTransactions(txs);
        const total = txs
          .filter((t) => t.type === "subscription_payment" && t.status === "completed")
          .reduce((sum, t) => sum + t.amount, 0);
        setTotalRevenue(total);
        setPlatformRevenue(Math.round(total * 0.2));
      }
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">전체 매출</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-[#00E676]" />
            <span className="text-[10px] text-[#8B95A5] uppercase">총 매출</span>
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {totalRevenue.toLocaleString()}원
          </p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#F5B800]" />
            <span className="text-[10px] text-[#8B95A5] uppercase">파트너 지분</span>
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {(totalRevenue - platformRevenue).toLocaleString()}원
          </p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="w-4 h-4 text-[#00E676]" />
            <span className="text-[10px] text-[#8B95A5] uppercase">플랫폼 수익</span>
          </div>
          <p className="text-lg font-bold text-[#00E676] font-mono">
            {platformRevenue.toLocaleString()}원
          </p>
        </Card>
      </div>

      <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden">
        <div className="p-4 border-b border-[#2A2D36]">
          <h3 className="text-sm font-semibold text-white">전체 거래 내역</h3>
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
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[#2A2D36]/50 hover:bg-[#22262F]">
                  <td className="p-3 text-xs text-[#8B95A5]">
                    {dayjs(tx.created_at).format("YY.MM.DD HH:mm")}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="border-[#2A2D36] text-[#8B95A5] text-[10px]">
                      {tx.type === "subscription_payment" ? "구독" : tx.type === "partner_payout" ? "출금" : "환불"}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-white">{tx.description || "-"}</td>
                  <td className="p-3 text-sm font-mono text-right text-white">
                    {tx.amount.toLocaleString()}원
                  </td>
                  <td className="p-3">
                    <Badge
                      className={
                        tx.status === "completed"
                          ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                          : "bg-[#F5B800]/10 text-[#F5B800] border-0 text-[10px]"
                      }
                    >
                      {tx.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

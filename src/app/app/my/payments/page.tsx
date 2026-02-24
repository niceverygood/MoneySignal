"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Receipt, Loader2 } from "lucide-react";
import type { Transaction } from "@/types";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

const STATUS_LABEL: Record<string, string> = {
  completed: "완료",
  pending: "대기",
  failed: "실패",
  cancelled: "취소",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-[#00E676]/10 text-[#00E676]",
  pending: "bg-[#F5B800]/10 text-[#F5B800]",
  failed: "bg-[#FF5252]/10 text-[#FF5252]",
  cancelled: "bg-[#FF5252]/10 text-[#FF5252]",
};

const TYPE_LABEL: Record<string, string> = {
  subscription_payment: "구독 결제",
  partner_payout: "파트너 정산",
  refund: "환불",
};

export default function PaymentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    async function fetchPayments() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (data) {
        setTransactions(data as Transaction[]);
        const spent = data
          .filter(
            (t) =>
              t.type === "subscription_payment" && t.status === "completed"
          )
          .reduce((sum, t) => sum + t.amount, 0);
        setTotalSpent(spent);
      }
      setLoading(false);
    }
    fetchPayments();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-[#8B95A5] hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-white">결제 내역</h1>
      </div>

      {/* Summary */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8B95A5]">총 결제 금액</p>
            <p className="text-xl font-bold text-white font-mono">
              {totalSpent.toLocaleString()}원
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#F5B800]/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[#F5B800]" />
          </div>
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-[#2A2D36] text-xs text-[#8B95A5]">
          <span>
            전체{" "}
            <strong className="text-white">{transactions.length}건</strong>
          </span>
          <span>
            결제{" "}
            <strong className="text-[#00E676]">
              {
                transactions.filter(
                  (t) =>
                    t.type === "subscription_payment" &&
                    t.status === "completed"
                ).length
              }
              건
            </strong>
          </span>
          <span>
            환불{" "}
            <strong className="text-[#FF5252]">
              {transactions.filter((t) => t.type === "refund").length}건
            </strong>
          </span>
        </div>
      </Card>

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-8">
          <div className="text-center">
            <Receipt className="w-10 h-10 text-[#8B95A5]/30 mx-auto mb-3" />
            <p className="text-sm text-[#8B95A5]">결제 내역이 없습니다</p>
            <Button
              onClick={() => router.push("/app/subscribe")}
              className="mt-3 bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] text-xs h-8"
            >
              구독 시작하기
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <Card
              key={tx.id}
              className="bg-[#1A1D26] border-[#2A2D36] p-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">
                      {tx.description || TYPE_LABEL[tx.type] || tx.type}
                    </p>
                    <Badge
                      className={`border-0 text-[9px] px-1.5 py-0 shrink-0 ${STATUS_COLOR[tx.status] || STATUS_COLOR.pending}`}
                    >
                      {STATUS_LABEL[tx.status] || tx.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#8B95A5]">
                      {dayjs(tx.created_at).format("YYYY.MM.DD HH:mm")}
                    </span>
                    <span className="text-[10px] text-[#8B95A5]/50">
                      {TYPE_LABEL[tx.type]}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-sm font-bold font-mono shrink-0 ml-3 ${
                    tx.type === "refund" || tx.status === "cancelled"
                      ? "text-[#FF5252]"
                      : "text-white"
                  }`}
                >
                  {tx.type === "refund" ? "-" : ""}
                  {tx.amount.toLocaleString()}원
                </span>
              </div>
              {tx.pg_transaction_id && (
                <p className="text-[9px] text-[#8B95A5]/40 mt-1.5 font-mono truncate">
                  PG: {tx.pg_transaction_id}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

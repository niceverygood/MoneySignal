"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";

interface WithdrawalRow {
  id: string;
  partner_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  partners?: { brand_name: string; available_balance: number; user_id: string };
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const supabase = createClient();

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  async function fetchWithdrawals() {
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*, partners(brand_name, available_balance, user_id)")
      .order("created_at", { ascending: false });

    if (data) setWithdrawals(data as WithdrawalRow[]);
    setLoading(false);
  }

  const handleApprove = async (wd: WithdrawalRow) => {
    setProcessing(wd.id);
    try {
      // Update withdrawal status
      await supabase
        .from("withdrawal_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          admin_note: adminNotes[wd.id] || null,
        })
        .eq("id", wd.id);

      // Deduct from partner balance
      const newBalance = (wd.partners?.available_balance || 0) - wd.amount;
      await supabase
        .from("partners")
        .update({
          available_balance: Math.max(0, newBalance),
          total_withdrawn:
            (wd.partners?.available_balance || 0) -
            Math.max(0, newBalance) +
            wd.amount,
        })
        .eq("id", wd.partner_id);

      // Create transaction record
      await supabase.from("transactions").insert({
        type: "partner_payout",
        partner_id: wd.partner_id,
        amount: wd.amount,
        status: "completed",
        description: `출금: ${wd.bank_name} ${wd.account_number}`,
      });

      toast.success("출금이 승인되었습니다");
      fetchWithdrawals();
    } catch {
      toast.error("처리에 실패했습니다");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (wd: WithdrawalRow) => {
    if (!adminNotes[wd.id]) {
      toast.error("거부 사유를 입력해주세요");
      return;
    }

    setProcessing(wd.id);
    try {
      await supabase
        .from("withdrawal_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          admin_note: adminNotes[wd.id],
        })
        .eq("id", wd.id);

      toast.success("출금이 거부되었습니다");
      fetchWithdrawals();
    } catch {
      toast.error("처리에 실패했습니다");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pending = withdrawals.filter((w) => w.status === "pending");
  const completed = withdrawals.filter((w) => w.status !== "pending");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">출금 처리</h1>

      {/* Pending withdrawals */}
      <div>
        <h2 className="text-sm font-semibold text-[#F5B800] mb-3">
          대기중 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-8 text-center">
            <p className="text-[#8B95A5]">대기중인 출금 요청이 없습니다</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((wd) => (
              <Card
                key={wd.id}
                className="bg-[#1A1D26] border-[#2A2D36] p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold">
                      {wd.partners?.brand_name || "Unknown"}
                    </p>
                    <p className="text-xs text-[#8B95A5]">
                      {dayjs(wd.created_at).format("YYYY.MM.DD HH:mm")}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {wd.amount.toLocaleString()}원
                  </p>
                </div>
                <div className="text-sm text-[#8B95A5] space-y-1 mb-3">
                  <p>은행: {wd.bank_name}</p>
                  <p>계좌: {wd.account_number}</p>
                  <p>예금주: {wd.account_holder}</p>
                  <p>
                    파트너 잔액:{" "}
                    {(wd.partners?.available_balance || 0).toLocaleString()}원
                  </p>
                </div>
                <Input
                  placeholder="관리자 메모 (거부 시 필수)"
                  value={adminNotes[wd.id] || ""}
                  onChange={(e) =>
                    setAdminNotes((prev) => ({
                      ...prev,
                      [wd.id]: e.target.value,
                    }))
                  }
                  className="bg-[#22262F] border-[#2A2D36] text-white mb-3 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(wd)}
                    disabled={processing === wd.id}
                    className="bg-[#00E676] text-[#0D0F14] hover:bg-[#00E676]/80 flex-1"
                  >
                    {processing === wd.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        승인
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(wd)}
                    disabled={processing === wd.id}
                    className="border-[#FF5252] text-[#FF5252] hover:bg-[#FF5252]/10 flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    거부
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed withdrawals */}
      <div>
        <h2 className="text-sm font-semibold text-[#8B95A5] mb-3">
          처리 완료 ({completed.length})
        </h2>
        <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2D36]">
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">파트너</th>
                <th className="text-right text-[10px] text-[#8B95A5] uppercase p-3">금액</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">요청일</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((wd) => (
                <tr key={wd.id} className="border-b border-[#2A2D36]/50">
                  <td className="p-3 text-sm text-white">
                    {wd.partners?.brand_name}
                  </td>
                  <td className="p-3 text-sm text-white font-mono text-right">
                    {wd.amount.toLocaleString()}원
                  </td>
                  <td className="p-3 text-sm text-[#8B95A5]">
                    {dayjs(wd.created_at).format("YY.MM.DD")}
                  </td>
                  <td className="p-3">
                    <Badge
                      className={
                        wd.status === "completed"
                          ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                          : "bg-[#FF5252]/10 text-[#FF5252] border-0 text-[10px]"
                      }
                    >
                      {wd.status === "completed" ? "완료" : "거부"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

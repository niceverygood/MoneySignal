"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2, Wallet } from "lucide-react";
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
  partners?: {
    brand_name: string;
    available_balance: number;
    user_id: string;
    referral_code: string | null;
    total_revenue: number;
    total_withdrawn: number;
  };
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const supabase = createClient();

  const fetchWithdrawals = async () => {
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*, partners(brand_name, available_balance, user_id, referral_code, total_revenue, total_withdrawn)")
      .order("created_at", { ascending: false });

    if (data) setWithdrawals(data as WithdrawalRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

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
      const currentBalance = Number(wd.partners?.available_balance || 0);
      const currentWithdrawn = Number(wd.partners?.total_withdrawn || 0);
      await supabase
        .from("partners")
        .update({
          available_balance: Math.max(0, currentBalance - wd.amount),
          total_withdrawn: currentWithdrawn + wd.amount,
        })
        .eq("id", wd.partner_id);

      // Record transaction
      await supabase.from("transactions").insert({
        type: "partner_payout",
        partner_id: wd.partner_id,
        amount: wd.amount,
        status: "completed",
        description: `출금 승인: ${wd.bank_name} ${wd.account_number} (${wd.account_holder})`,
      });

      // Notify partner
      if (wd.partners?.user_id) {
        await supabase.from("notifications").insert({
          user_id: wd.partners.user_id,
          type: "payout",
          title: "출금 완료",
          body: `${wd.amount.toLocaleString()}원이 ${wd.bank_name} 계좌로 출금 처리되었습니다.`,
        });
      }

      toast.success("출금 승인 완료!");
      fetchWithdrawals();
    } catch {
      toast.error("처리 실패");
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

      if (wd.partners?.user_id) {
        await supabase.from("notifications").insert({
          user_id: wd.partners.user_id,
          type: "payout",
          title: "출금 거부",
          body: `출금 요청이 거부되었습니다. 사유: ${adminNotes[wd.id]}`,
        });
      }

      toast.success("출금 거부 처리됨");
      fetchWithdrawals();
    } catch {
      toast.error("처리 실패");
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
  const processed = withdrawals.filter((w) => w.status !== "pending");
  const totalPending = pending.reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">출금 관리</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#1A1D26] border-[#F5B800]/20 p-4 text-center">
          <Wallet className="w-5 h-5 text-[#F5B800] mx-auto mb-1" />
          <p className="text-[10px] text-[#8B95A5]">대기중</p>
          <p className="text-xl font-bold text-[#F5B800]">{pending.length}건</p>
          <p className="text-xs text-[#8B95A5]">{totalPending.toLocaleString()}원</p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 text-center">
          <p className="text-[10px] text-[#8B95A5]">이번달 처리</p>
          <p className="text-xl font-bold text-[#00E676]">
            {processed.filter((w) => w.status === "completed").length}건
          </p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 text-center">
          <p className="text-[10px] text-[#8B95A5]">거부</p>
          <p className="text-xl font-bold text-[#FF5252]">
            {processed.filter((w) => w.status === "rejected").length}건
          </p>
        </Card>
      </div>

      {/* Pending Withdrawals */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#F5B800] mb-3">
            승인 대기 ({pending.length}건)
          </h2>
          <div className="space-y-3">
            {pending.map((wd) => (
              <Card key={wd.id} className="bg-[#1A1D26] border-[#F5B800]/20 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold">
                      {wd.partners?.brand_name || "알 수 없음"}
                    </p>
                    <p className="text-xs text-[#8B95A5]">
                      코드: {wd.partners?.referral_code || "-"} ·{" "}
                      {dayjs(wd.created_at).format("MM.DD HH:mm")}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-white font-mono">
                    {wd.amount.toLocaleString()}원
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-[#8B95A5] mb-3 p-2 bg-[#22262F] rounded-lg">
                  <p>은행: {wd.bank_name}</p>
                  <p>계좌: {wd.account_number}</p>
                  <p>예금주: {wd.account_holder}</p>
                  <p>잔액: {Number(wd.partners?.available_balance || 0).toLocaleString()}원</p>
                </div>

                <Input
                  placeholder="관리자 메모 (거부 시 필수)"
                  value={adminNotes[wd.id] || ""}
                  onChange={(e) =>
                    setAdminNotes((prev) => ({ ...prev, [wd.id]: e.target.value }))
                  }
                  className="bg-[#22262F] border-[#2A2D36] text-white mb-3 text-xs"
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
                      <><CheckCircle2 className="w-4 h-4 mr-1" /> 승인</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(wd)}
                    disabled={processing === wd.id}
                    className="border-[#FF5252] text-[#FF5252] hover:bg-[#FF5252]/10 flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-1" /> 거부
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Processed History */}
      <div>
        <h2 className="text-sm font-semibold text-[#8B95A5] mb-3">
          처리 완료 ({processed.length}건)
        </h2>
        <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2D36]">
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">운영자</th>
                <th className="text-right text-[10px] text-[#8B95A5] uppercase p-3">금액</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">은행</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">날짜</th>
                <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {processed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-sm text-[#8B95A5]">
                    처리된 출금이 없습니다
                  </td>
                </tr>
              ) : (
                processed.map((wd) => (
                  <tr key={wd.id} className="border-b border-[#2A2D36]/50 hover:bg-[#22262F]">
                    <td className="p-3 text-sm text-white">{wd.partners?.brand_name}</td>
                    <td className="p-3 text-sm text-white font-mono text-right">
                      {wd.amount.toLocaleString()}원
                    </td>
                    <td className="p-3 text-xs text-[#8B95A5]">{wd.bank_name}</td>
                    <td className="p-3 text-xs text-[#8B95A5]">
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
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Partner, WithdrawalRequest } from "@/types";
import dayjs from "dayjs";

const banks = [
  "KB국민은행", "신한은행", "하나은행", "우리은행", "NH농협은행",
  "IBK기업은행", "카카오뱅크", "토스뱅크", "케이뱅크",
];

export default function WithdrawPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
  });
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

        const { data: wdData } = await supabase
          .from("withdrawal_requests")
          .select("*")
          .eq("partner_id", partnerData.id)
          .order("created_at", { ascending: false });

        if (wdData) setWithdrawals(wdData as WithdrawalRequest[]);
      }
      setLoading(false);
    }

    fetchData();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(form.amount) * 10000;

    if (!form.amount || amount < 50000) {
      toast.error("최소 출금 금액은 5만원입니다");
      return;
    }
    if (amount > Number(partner?.available_balance || 0)) {
      toast.error("출금 가능 금액을 초과했습니다");
      return;
    }
    if (!form.bankName || !form.accountNumber || !form.accountHolder) {
      toast.error("모든 필드를 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("withdrawal_requests").insert({
        partner_id: partner!.id,
        amount,
        bank_name: form.bankName,
        account_number: form.accountNumber,
        account_holder: form.accountHolder,
      });

      if (error) throw error;

      toast.success("출금 요청이 접수되었습니다");
      setForm({ amount: "", bankName: "", accountNumber: "", accountHolder: "" });

      // Refresh data
      const { data: wdData } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("partner_id", partner!.id)
        .order("created_at", { ascending: false });

      if (wdData) setWithdrawals(wdData as WithdrawalRequest[]);
    } catch (error) {
      toast.error("출금 요청에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">출금</h1>

      {/* Balance */}
      <Card className="bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border-[#F5B800]/20 p-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-[#F5B800]" />
          <div>
            <p className="text-sm text-[#8B95A5]">출금 가능 금액</p>
            <p className="text-2xl font-bold text-white font-mono">
              {Number(partner?.available_balance || 0).toLocaleString()}원
            </p>
          </div>
        </div>
      </Card>

      {/* Withdrawal form */}
      <form onSubmit={handleSubmit}>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">출금 요청</h3>

          <div>
            <Label className="text-[#8B95A5]">출금 금액 (만원)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="최소 5만원"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
            />
          </div>

          <div>
            <Label className="text-[#8B95A5]">은행</Label>
            <Select
              value={form.bankName}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, bankName: val }))
              }
            >
              <SelectTrigger className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5">
                <SelectValue placeholder="은행 선택" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                {banks.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[#8B95A5]">계좌번호</Label>
            <Input
              value={form.accountNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, accountNumber: e.target.value }))
              }
              placeholder="- 없이 입력"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
            />
          </div>

          <div>
            <Label className="text-[#8B95A5]">예금주</Label>
            <Input
              value={form.accountHolder}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  accountHolder: e.target.value,
                }))
              }
              placeholder="예금주명 입력"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            출금 요청하기
          </Button>
        </Card>
      </form>

      {/* Withdrawal history */}
      <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
        <h3 className="text-sm font-semibold text-white mb-3">출금 이력</h3>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-[#8B95A5] text-center py-4">
            출금 이력이 없습니다
          </p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((wd) => (
              <div
                key={wd.id}
                className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-[#22262F]"
              >
                <span className="text-[#8B95A5]">
                  {dayjs(wd.created_at).format("YY.MM.DD")}
                </span>
                <span className="text-white font-mono">
                  {wd.amount.toLocaleString()}원
                </span>
                <span className="text-[#8B95A5] text-xs">
                  {wd.bank_name}
                </span>
                <Badge
                  className={
                    wd.status === "completed"
                      ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                      : wd.status === "rejected"
                        ? "bg-[#FF5252]/10 text-[#FF5252] border-0 text-[10px]"
                        : "bg-[#F5B800]/10 text-[#F5B800] border-0 text-[10px]"
                  }
                >
                  {wd.status === "completed"
                    ? "완료"
                    : wd.status === "rejected"
                      ? "거부"
                      : wd.status === "processing"
                        ? "처리중"
                        : "대기중"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crown,
  DollarSign,
  Users,
  Zap,
  Loader2,
  CheckCircle2,
  Copy,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function BecomePartnerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [existingPartner, setExistingPartner] = useState<{
    is_active: boolean;
    referral_code: string;
    brand_name: string;
  } | null>(null);

  const [form, setForm] = useState({
    brandName: "",
    channel: "",
    subscriberCount: "",
    category: "",
    bio: "",
  });

  useEffect(() => {
    async function checkPartner() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("partners")
        .select("is_active, referral_code, brand_name")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setExistingPartner(data);
        setReferralCode(data.referral_code || "");
      }
    }
    checkPartner();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandName) {
      toast.error("브랜드명을 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }

      setReferralCode(data.referralCode);
      setApplied(true);
      toast.success(data.message);
    } catch {
      toast.error("신청 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success("추천코드가 복사되었습니다!");
  };

  // Already a partner
  if (existingPartner) {
    return (
      <div className="py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[#8B95A5] -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> 뒤로
        </Button>

        <div className="text-center py-4">
          <Crown className="w-12 h-12 text-[#F5B800] mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">운영자 상태</h1>
          <Badge className={existingPartner.is_active
            ? "bg-[#00E676]/10 text-[#00E676] border-0 mt-2"
            : "bg-[#F5B800]/10 text-[#F5B800] border-0 mt-2"
          }>
            {existingPartner.is_active ? "✅ 승인됨" : "⏳ 승인 대기중"}
          </Badge>
        </div>

        <Card className="bg-[#1A1D26] border-[#2A2D36] p-5 text-center">
          <p className="text-sm text-[#8B95A5] mb-2">내 추천코드</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-bold text-[#F5B800] font-mono tracking-widest">
              {referralCode}
            </span>
            <Button variant="ghost" size="sm" onClick={copyCode} className="text-[#8B95A5]">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-[#8B95A5] mt-3">
            이 코드를 유저에게 공유하세요. 유저가 코드를 입력하고 구독하면
            <br />매출의 <span className="text-[#F5B800] font-bold">80%</span>가 수익으로 정산됩니다.
          </p>
        </Card>

        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
          <h3 className="text-sm font-semibold text-white mb-3">수익 쉐어 구조</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8B95A5]">운영자 수익</span>
              <span className="text-[#00E676] font-bold">80%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8B95A5]">플랫폼 수익</span>
              <span className="text-white">20%</span>
            </div>
            <div className="border-t border-[#2A2D36] pt-2 mt-2">
              <p className="text-xs text-[#8B95A5]">
                예: 유저가 월 99,000원 구독 → 운영자 79,200원 / 플랫폼 19,800원
              </p>
            </div>
          </div>
        </Card>

        {existingPartner.is_active && (
          <Button
            onClick={() => router.push("/partner/dashboard")}
            className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
          >
            운영자 대시보드 가기 →
          </Button>
        )}
      </div>
    );
  }

  // Applied successfully
  if (applied) {
    return (
      <div className="py-4 space-y-4 text-center">
        <CheckCircle2 className="w-16 h-16 text-[#00E676] mx-auto" />
        <h1 className="text-xl font-bold text-white">운영자 신청 완료!</h1>
        <p className="text-sm text-[#8B95A5]">관리자 승인 후 활동이 가능합니다.</p>

        <Card className="bg-[#1A1D26] border-[#2A2D36] p-5">
          <p className="text-sm text-[#8B95A5] mb-2">내 추천코드 (승인 후 활성)</p>
          <span className="text-2xl font-bold text-[#F5B800] font-mono tracking-widest">
            {referralCode}
          </span>
        </Card>

        <Button onClick={() => router.push("/app")} variant="outline" className="border-[#2A2D36] text-white">
          시그널 피드로 돌아가기
        </Button>
      </div>
    );
  }

  // Application form
  return (
    <div className="py-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[#8B95A5] -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> 뒤로
      </Button>

      <div className="text-center">
        <Crown className="w-10 h-10 text-[#F5B800] mx-auto mb-3" />
        <h1 className="text-xl font-bold text-white">운영자 신청</h1>
        <p className="text-sm text-[#8B95A5] mt-1">
          운영자가 되어 수익을 창출하세요
        </p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 text-center">
          <DollarSign className="w-5 h-5 text-[#00E676] mx-auto mb-1" />
          <p className="text-lg font-bold text-white">80%</p>
          <p className="text-[10px] text-[#8B95A5]">수익 쉐어</p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 text-center">
          <Users className="w-5 h-5 text-[#448AFF] mx-auto mb-1" />
          <p className="text-lg font-bold text-white">고유코드</p>
          <p className="text-[10px] text-[#8B95A5]">유저 추적</p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 text-center">
          <Zap className="w-5 h-5 text-[#F5B800] mx-auto mb-1" />
          <p className="text-lg font-bold text-white">자동정산</p>
          <p className="text-[10px] text-[#8B95A5]">매월 정산</p>
        </Card>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-5 space-y-4">
          <div>
            <Label className="text-[#8B95A5]">브랜드명 / 활동명 *</Label>
            <Input
              value={form.brandName}
              onChange={(e) => setForm((p) => ({ ...p, brandName: e.target.value }))}
              placeholder="예: 크립토마스터"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              required
            />
          </div>
          <div>
            <Label className="text-[#8B95A5]">운영 채널</Label>
            <Input
              value={form.channel}
              onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
              placeholder="텔레그램, 카카오, 유튜브 등"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
            />
          </div>
          <div>
            <Label className="text-[#8B95A5]">현재 팔로워/구독자 수</Label>
            <Input
              value={form.subscriberCount}
              onChange={(e) => setForm((p) => ({ ...p, subscriberCount: e.target.value }))}
              placeholder="예: 약 500명"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
            />
          </div>
          <div>
            <Label className="text-[#8B95A5]">관심 카테고리</Label>
            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
              <SelectTrigger className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5">
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                <SelectItem value="coin">코인</SelectItem>
                <SelectItem value="futures">해외선물</SelectItem>
                <SelectItem value="stock">국내주식</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[#8B95A5]">자기소개 (선택)</Label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="트레이딩 경력, 전문 분야 등"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5 min-h-[80px]"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold h-11"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            운영자 신청하기
          </Button>
        </Card>
      </form>
    </div>
  );
}

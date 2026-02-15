"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, Crown, DollarSign, BarChart3, Zap } from "lucide-react";
import { toast } from "sonner";

const categories = [
  { value: "coin_spot", label: "코인 현물" },
  { value: "coin_futures", label: "코인 선물" },
  { value: "overseas_futures", label: "해외선물" },
  { value: "kr_stock", label: "국내주식" },
  { value: "bundle", label: "복합/번들" },
];

export default function PartnerApplyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    brandName: "",
    brandSlug: "",
    channel: "",
    subscriberCount: "",
    category: "",
    bio: "",
    agreeTerms: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandName || !form.brandSlug || !form.agreeTerms) {
      toast.error("필수 항목을 모두 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login?redirectTo=/partner/apply");
        return;
      }

      // Check if already a partner
      const { data: existing } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        toast.error("이미 파트너 신청이 완료되었습니다");
        return;
      }

      // Create partner (inactive, pending approval)
      const { error } = await supabase.from("partners").insert({
        user_id: user.id,
        brand_name: form.brandName,
        brand_slug: form.brandSlug
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-"),
        bio: form.bio || `${form.channel} 운영 | ${form.subscriberCount}명 구독자`,
        is_active: false, // Pending admin approval
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("이미 사용 중인 슬러그입니다");
        } else {
          throw error;
        }
        return;
      }

      toast.success("파트너 신청이 완료되었습니다! 관리자 승인을 기다려주세요.");
      router.push("/app");
    } catch (error) {
      toast.error("신청 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0F14]">
      <header className="border-b border-[#2A2D36]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-[#8B95A5] hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-lg font-bold text-gold-gradient">
            MONEY SIGNAL
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <Crown className="w-12 h-12 text-[#F5B800] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">파트너 신청</h1>
          <p className="text-sm text-[#8B95A5] mt-2">
            리딩방 운영자라면 파트너로 합류하세요
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 text-center">
            <DollarSign className="w-5 h-5 text-[#00E676] mx-auto mb-1" />
            <p className="text-xs text-[#8B95A5]">매출의</p>
            <p className="text-lg font-bold text-white">80~88%</p>
          </Card>
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 text-center">
            <BarChart3 className="w-5 h-5 text-[#448AFF] mx-auto mb-1" />
            <p className="text-xs text-[#8B95A5]">자동</p>
            <p className="text-lg font-bold text-white">대시보드</p>
          </Card>
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-3 text-center">
            <Zap className="w-5 h-5 text-[#F5B800] mx-auto mb-1" />
            <p className="text-xs text-[#8B95A5]">AI 시그널</p>
            <p className="text-lg font-bold text-white">자동 제공</p>
          </Card>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-6 space-y-4">
            <div>
              <Label className="text-[#8B95A5]">브랜드명 *</Label>
              <Input
                value={form.brandName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, brandName: e.target.value }))
                }
                placeholder="예: 크립토킹"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
                required
              />
            </div>

            <div>
              <Label className="text-[#8B95A5]">URL 슬러그 *</Label>
              <Input
                value={form.brandSlug}
                onChange={(e) =>
                  setForm((p) => ({ ...p, brandSlug: e.target.value }))
                }
                placeholder="crypto-king"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
                required
              />
              <p className="text-[10px] text-[#8B95A5] mt-1">
                moneysignal.io/p/{form.brandSlug || "your-slug"}
              </p>
            </div>

            <div>
              <Label className="text-[#8B95A5]">운영 채널</Label>
              <Input
                value={form.channel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, channel: e.target.value }))
                }
                placeholder="텔레그램, 카카오, 네이버 등"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>

            <div>
              <Label className="text-[#8B95A5]">현재 구독자 규모</Label>
              <Input
                value={form.subscriberCount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, subscriberCount: e.target.value }))
                }
                placeholder="예: 약 500명"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>

            <div>
              <Label className="text-[#8B95A5]">관심 카테고리</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, category: v }))
                }
              >
                <SelectTrigger className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[#8B95A5]">자기소개</Label>
              <Textarea
                value={form.bio}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bio: e.target.value }))
                }
                placeholder="경력, 전문 분야, 트레이딩 스타일 등"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5 min-h-[100px]"
              />
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                checked={form.agreeTerms}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, agreeTerms: checked as boolean }))
                }
                className="border-[#2A2D36] data-[state=checked]:bg-[#F5B800] data-[state=checked]:border-[#F5B800] mt-0.5"
              />
              <span className="text-xs text-[#8B95A5]">
                파트너 이용약관에 동의합니다. 승인 후 상품을 등록하고 수익을 받을
                수 있습니다.
              </span>
            </div>

            <Button
              type="submit"
              disabled={loading || !form.agreeTerms}
              className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              파트너 신청하기
            </Button>
          </Card>
        </form>
      </main>
    </div>
  );
}

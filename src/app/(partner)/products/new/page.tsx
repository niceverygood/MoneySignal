"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const featureOptions = [
  "실시간 AI 시그널",
  "시그널 알림 (푸시)",
  "AI 분석 근거 열람",
  "백테스트 상세 데이터",
  "프리미엄 채팅방 입장",
  "1:1 AI 상담",
  "주간 리포트",
];

export default function NewProductPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    priceMonthly: "",
    priceQuarterly: "",
    priceYearly: "",
    description: "",
    features: [] as string[],
    maxSignalsPerDay: "10",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.priceMonthly) {
      toast.error("필수 항목을 모두 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!partner) throw new Error("Partner not found");

      const slug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, "-")
        .replace(/-+/g, "-");

      const { error } = await supabase.from("products").insert({
        partner_id: partner.id,
        name: form.name,
        slug,
        category: form.category,
        price_monthly: parseInt(form.priceMonthly) * 10000,
        price_quarterly: form.priceQuarterly
          ? parseInt(form.priceQuarterly) * 10000
          : null,
        price_yearly: form.priceYearly
          ? parseInt(form.priceYearly) * 10000
          : null,
        description: form.description,
        features: form.features,
        max_signals_per_day: parseInt(form.maxSignalsPerDay) || 10,
      });

      if (error) throw error;

      toast.success("상품이 생성되었습니다");
      router.push("/partner/products");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "상품 생성에 실패했습니다"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = (feature: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-[#8B95A5] hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">새 상품 만들기</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-6 space-y-5">
          <div>
            <Label className="text-[#8B95A5]">상품명 *</Label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="예: 코인 선물 프리미엄"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
            />
          </div>

          <div>
            <Label className="text-[#8B95A5]">카테고리 *</Label>
            <Select
              value={form.category}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, category: val }))
              }
            >
              <SelectTrigger className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5">
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                <SelectItem value="coin_spot">코인 현물</SelectItem>
                <SelectItem value="coin_futures">코인 선물</SelectItem>
                <SelectItem value="overseas_futures">해외선물</SelectItem>
                <SelectItem value="kr_stock">국내주식</SelectItem>
                <SelectItem value="bundle">프리미엄 번들</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-[#8B95A5]">월 구독료 (만원) *</Label>
              <Input
                type="number"
                value={form.priceMonthly}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priceMonthly: e.target.value,
                  }))
                }
                placeholder="9.9"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>
            <div>
              <Label className="text-[#8B95A5]">분기 (만원)</Label>
              <Input
                type="number"
                value={form.priceQuarterly}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priceQuarterly: e.target.value,
                  }))
                }
                placeholder="24.9"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>
            <div>
              <Label className="text-[#8B95A5]">연간 (만원)</Label>
              <Input
                type="number"
                value={form.priceYearly}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priceYearly: e.target.value,
                  }))
                }
                placeholder="89.9"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label className="text-[#8B95A5]">설명</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="상품 설명을 입력하세요"
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5 min-h-[100px]"
            />
          </div>

          <div>
            <Label className="text-[#8B95A5] mb-3 block">포함 기능</Label>
            <div className="space-y-2.5">
              {featureOptions.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <Checkbox
                    checked={form.features.includes(feature)}
                    onCheckedChange={() => toggleFeature(feature)}
                    className="border-[#2A2D36] data-[state=checked]:bg-[#F5B800] data-[state=checked]:border-[#F5B800]"
                  />
                  <span className="text-sm text-[#8B95A5]">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[#8B95A5]">하루 최대 시그널 수</Label>
            <Input
              type="number"
              value={form.maxSignalsPerDay}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  maxSignalsPerDay: e.target.value,
                }))
              }
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5 w-32"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            상품 생성하기
          </Button>
        </Card>
      </form>
    </div>
  );
}

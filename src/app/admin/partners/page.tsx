"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Partner } from "@/types";
import dayjs from "dayjs";

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchPartners = async () => {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPartners(data as Partner[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("partners").update({ is_active: isActive }).eq("id", id);

    if (isActive) {
      // Also update the user's role to partner
      const partner = partners.find((p) => p.id === id);
      if (partner) {
        await supabase
          .from("profiles")
          .update({ role: "partner" })
          .eq("id", partner.user_id);
      }
    }

    setPartners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: isActive } : p))
    );
    toast.success(isActive ? "파트너가 활성화되었습니다" : "파트너가 비활성화되었습니다");
  };

  const updateTier = async (id: string, tier: string) => {
    const rateMap: Record<string, number> = {
      starter: 0.8,
      pro: 0.83,
      elite: 0.85,
      legend: 0.88,
    };

    await supabase
      .from("partners")
      .update({ tier, revenue_share_rate: rateMap[tier] || 0.8 })
      .eq("id", id);

    setPartners((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, tier: tier as Partner["tier"], revenue_share_rate: rateMap[tier] || 0.8 }
          : p
      )
    );
    toast.success("등급이 변경되었습니다");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">파트너 관리</h1>

      <div className="grid gap-4">
        {partners.map((partner) => (
          <Card key={partner.id} className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-white font-semibold">
                    {partner.brand_name}
                  </h3>
                  <Badge
                    className={
                      partner.is_active
                        ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                        : "bg-[#FF5252]/10 text-[#FF5252] border-0 text-[10px]"
                    }
                  >
                    {partner.is_active ? "활성" : "비활성"}
                  </Badge>
                </div>
                <p className="text-xs text-[#8B95A5]">
                  /p/{partner.brand_slug} · 가입일{" "}
                  {dayjs(partner.created_at).format("YY.MM.DD")}
                </p>
                <div className="flex gap-4 mt-2 text-sm text-[#8B95A5]">
                  <span>구독자: {partner.subscriber_count}명</span>
                  <span>
                    총매출: {Number(partner.total_revenue).toLocaleString()}원
                  </span>
                  <span>
                    수수료: {Math.round(partner.revenue_share_rate * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Select
                  value={partner.tier}
                  onValueChange={(v) => updateTier(partner.id, v)}
                >
                  <SelectTrigger className="w-28 bg-[#22262F] border-[#2A2D36] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                    <SelectItem value="legend">Legend</SelectItem>
                  </SelectContent>
                </Select>

                <Switch
                  checked={partner.is_active}
                  onCheckedChange={(checked) =>
                    toggleActive(partner.id, checked)
                  }
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

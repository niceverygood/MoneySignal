"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  DollarSign,
  Copy,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";

interface PartnerRow {
  id: string;
  user_id: string;
  brand_name: string;
  brand_slug: string;
  referral_code: string | null;
  tier: string;
  revenue_share_rate: number;
  total_revenue: number;
  available_balance: number;
  subscriber_count: number;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  profiles?: { display_name: string; email: string };
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchPartners = async () => {
    let query = supabase
      .from("partners")
      .select("*, profiles(display_name, email)")
      .order("created_at", { ascending: false });

    const { data } = await query;
    if (data) setPartners(data as PartnerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const approvePartner = async (partner: PartnerRow) => {
    // Activate partner
    await supabase
      .from("partners")
      .update({ is_active: true })
      .eq("id", partner.id);

    // Update user role to 'partner'
    await supabase
      .from("profiles")
      .update({ role: "partner" })
      .eq("id", partner.user_id);

    toast.success(`${partner.brand_name} 승인 완료!`);
    fetchPartners();
  };

  const rejectPartner = async (partner: PartnerRow) => {
    await supabase
      .from("partners")
      .update({ is_active: false })
      .eq("id", partner.id);

    toast.success(`${partner.brand_name} 거부됨`);
    fetchPartners();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase
      .from("partners")
      .update({ is_active: isActive })
      .eq("id", id);

    const partner = partners.find((p) => p.id === id);
    if (partner) {
      await supabase
        .from("profiles")
        .update({ role: isActive ? "partner" : "user" })
        .eq("id", partner.user_id);
    }

    toast.success(isActive ? "활성화됨" : "비활성화됨");
    fetchPartners();
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

    toast.success("등급 변경됨");
    fetchPartners();
  };

  // Filtered list
  const filtered = partners.filter((p) => {
    if (filter === "pending" && p.is_active) return false;
    if (filter === "active" && !p.is_active) return false;
    if (filter === "inactive" && p.is_active) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        p.brand_name.toLowerCase().includes(s) ||
        p.profiles?.email?.toLowerCase().includes(s) ||
        p.referral_code?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const pendingCount = partners.filter((p) => !p.is_active).length;
  const activeCount = partners.filter((p) => p.is_active).length;
  const totalRevenue = partners.reduce((sum, p) => sum + Number(p.total_revenue), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">운영자 관리</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 text-center">
          <p className="text-[10px] text-[#8B95A5] uppercase">전체</p>
          <p className="text-2xl font-bold text-white">{partners.length}</p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#F5B800]/20 p-4 text-center">
          <p className="text-[10px] text-[#F5B800] uppercase">승인 대기</p>
          <p className="text-2xl font-bold text-[#F5B800]">{pendingCount}</p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#00E676]/20 p-4 text-center">
          <p className="text-[10px] text-[#00E676] uppercase">활성</p>
          <p className="text-2xl font-bold text-[#00E676]">{activeCount}</p>
        </Card>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 text-center">
          <p className="text-[10px] text-[#8B95A5] uppercase">총 매출</p>
          <p className="text-lg font-bold text-white">{Math.round(totalRevenue / 10000).toLocaleString()}만원</p>
        </Card>
      </div>

      {/* Filter + Search */}
      <div className="flex gap-3">
        <div className="flex gap-1 bg-[#1A1D26] rounded-lg p-1">
          {[
            { key: "all", label: "전체" },
            { key: "pending", label: `대기 (${pendingCount})` },
            { key: "active", label: "활성" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-[#F5B800] text-[#0D0F14]"
                  : "text-[#8B95A5] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A5]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 이메일, 코드 검색"
            className="pl-10 bg-[#1A1D26] border-[#2A2D36] text-white"
          />
        </div>
      </div>

      {/* Partner List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-8 text-center">
            <p className="text-[#8B95A5]">해당하는 운영자가 없습니다</p>
          </Card>
        ) : (
          filtered.map((partner) => (
            <Card
              key={partner.id}
              className={`bg-[#1A1D26] border-[#2A2D36] p-4 ${
                !partner.is_active ? "border-l-2 border-l-[#F5B800]" : ""
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{partner.brand_name}</h3>
                    <Badge
                      className={
                        partner.is_active
                          ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                          : "bg-[#F5B800]/10 text-[#F5B800] border-0 text-[10px]"
                      }
                    >
                      {partner.is_active ? "활성" : "⏳ 승인 대기"}
                    </Badge>
                    <Badge className="bg-[#22262F] text-[#8B95A5] border-0 text-[10px]">
                      {partner.tier.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A5] mt-1">
                    {partner.profiles?.email} · 가입{" "}
                    {dayjs(partner.created_at).format("YY.MM.DD")}
                  </p>
                  {partner.bio && (
                    <p className="text-xs text-[#8B95A5] mt-1">{partner.bio}</p>
                  )}
                </div>

                {/* Actions for pending */}
                {!partner.is_active && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approvePartner(partner)}
                      className="bg-[#00E676] text-[#0D0F14] hover:bg-[#00E676]/80 h-8"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectPartner(partner)}
                      className="border-[#FF5252] text-[#FF5252] hover:bg-[#FF5252]/10 h-8"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      거부
                    </Button>
                  </div>
                )}

                {/* Toggle for active partners */}
                {partner.is_active && (
                  <Switch
                    checked={partner.is_active}
                    onCheckedChange={(checked) => toggleActive(partner.id, checked)}
                  />
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-3 text-center pt-3 border-t border-[#2A2D36]">
                <div>
                  <p className="text-[10px] text-[#8B95A5]">추천코드</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-sm font-bold text-[#F5B800] font-mono">
                      {partner.referral_code || "-"}
                    </p>
                    {partner.referral_code && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(partner.referral_code!);
                          toast.success("복사됨");
                        }}
                        className="text-[#8B95A5] hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[#8B95A5]">구독자</p>
                  <p className="text-sm font-bold text-white">{partner.subscriber_count}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#8B95A5]">총 매출</p>
                  <p className="text-sm font-bold text-white">
                    {Number(partner.total_revenue).toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#8B95A5]">수수료율</p>
                  <p className="text-sm font-bold text-[#00E676]">
                    {Math.round(partner.revenue_share_rate * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#8B95A5]">출금 가능</p>
                  <p className="text-sm font-bold text-white">
                    {Number(partner.available_balance).toLocaleString()}원
                  </p>
                </div>
              </div>

              {/* Tier selector for active partners */}
              {partner.is_active && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#2A2D36]">
                  <span className="text-xs text-[#8B95A5]">등급:</span>
                  <Select
                    value={partner.tier}
                    onValueChange={(v) => updateTier(partner.id, v)}
                  >
                    <SelectTrigger className="w-28 bg-[#22262F] border-[#2A2D36] text-white text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                      <SelectItem value="starter">Starter (80%)</SelectItem>
                      <SelectItem value="pro">Pro (83%)</SelectItem>
                      <SelectItem value="elite">Elite (85%)</SelectItem>
                      <SelectItem value="legend">Legend (88%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

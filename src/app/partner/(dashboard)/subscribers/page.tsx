"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Users } from "lucide-react";
import dayjs from "dayjs";

interface SubscriberRow {
  id: string;
  user_id: string;
  status: string;
  billing_cycle: string;
  amount_paid: number;
  current_period_end: string;
  created_at: string;
  profiles?: { display_name: string; email: string };
  products?: { name: string };
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchSubscribers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (partner) {
        const { data } = await supabase
          .from("subscriptions")
          .select("*, profiles(display_name, email), products(name)")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false });

        if (data) setSubscribers(data as SubscriberRow[]);
      }
      setLoading(false);
    }

    fetchSubscribers();
  }, [supabase]);

  const filtered = subscribers.filter(
    (s) =>
      !search ||
      s.profiles?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.profiles?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const csv = [
      "유저,이메일,상품,가입일,만료일,상태,결제금액",
      ...filtered.map(
        (s) =>
          `${s.profiles?.display_name || ""},${s.profiles?.email || ""},${s.products?.name || ""},${dayjs(s.created_at).format("YYYY-MM-DD")},${dayjs(s.current_period_end).format("YYYY-MM-DD")},${s.status},${s.amount_paid}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers_${dayjs().format("YYYYMMDD")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">구독자 관리</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          className="border-[#2A2D36] text-[#8B95A5] hover:text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          CSV 내보내기
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A5]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="유저 이름 또는 이메일 검색"
          className="pl-10 bg-[#1A1D26] border-[#2A2D36] text-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-8 text-center">
          <Users className="w-12 h-12 text-[#2A2D36] mx-auto mb-3" />
          <p className="text-[#8B95A5]">구독자가 없습니다</p>
        </Card>
      ) : (
        <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2D36]">
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase tracking-wider p-3">
                    유저
                  </th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase tracking-wider p-3">
                    상품
                  </th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase tracking-wider p-3">
                    가입일
                  </th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase tracking-wider p-3">
                    만료일
                  </th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase tracking-wider p-3">
                    상태
                  </th>
                  <th className="text-right text-[10px] text-[#8B95A5] uppercase tracking-wider p-3">
                    결제금액
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-[#2A2D36]/50 hover:bg-[#22262F] transition-colors"
                  >
                    <td className="p-3">
                      <p className="text-sm text-white">
                        {sub.profiles?.display_name || "알 수 없음"}
                      </p>
                      <p className="text-[10px] text-[#8B95A5]">
                        {sub.profiles?.email}
                      </p>
                    </td>
                    <td className="p-3 text-sm text-[#8B95A5]">
                      {sub.products?.name || "-"}
                    </td>
                    <td className="p-3 text-sm text-[#8B95A5]">
                      {dayjs(sub.created_at).format("YY.MM.DD")}
                    </td>
                    <td className="p-3 text-sm text-[#8B95A5]">
                      {dayjs(sub.current_period_end).format("YY.MM.DD")}
                    </td>
                    <td className="p-3">
                      <Badge
                        className={
                          sub.status === "active"
                            ? "bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]"
                            : "bg-[#FF5252]/10 text-[#FF5252] border-0 text-[10px]"
                        }
                      >
                        {sub.status === "active" ? "활성" : sub.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-white font-mono text-right">
                      {sub.amount_paid.toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

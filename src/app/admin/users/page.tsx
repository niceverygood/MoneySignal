"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Profile } from "@/types";
import { TIER_LABELS } from "@/types";
import dayjs from "dayjs";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (data) setUsers(data as Profile[]);
      setLoading(false);
    }

    fetchUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">유저 관리</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A5]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이메일 또는 이름 검색"
          className="pl-10 bg-[#1A1D26] border-[#2A2D36] text-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2D36]">
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">유저</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">역할</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">구독</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">만료일</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">가입일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#2A2D36]/50 hover:bg-[#22262F]"
                  >
                    <td className="p-3">
                      <p className="text-sm text-white">{user.display_name}</p>
                      <p className="text-[10px] text-[#8B95A5]">{user.email}</p>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          user.role === "admin"
                            ? "border-[#FF5252] text-[#FF5252] text-[10px]"
                            : user.role === "partner"
                              ? "border-[#F5B800] text-[#F5B800] text-[10px]"
                              : "border-[#2A2D36] text-[#8B95A5] text-[10px]"
                        }
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className="bg-[#22262F] text-[#8B95A5] border-0 text-[10px]">
                        {TIER_LABELS[user.subscription_tier]}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-[#8B95A5]">
                      {user.subscription_expires_at
                        ? dayjs(user.subscription_expires_at).format("YY.MM.DD")
                        : "-"}
                    </td>
                    <td className="p-3 text-xs text-[#8B95A5]">
                      {dayjs(user.created_at).format("YY.MM.DD")}
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

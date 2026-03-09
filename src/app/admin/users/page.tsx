"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Ban, CheckCircle } from "lucide-react";
import type { Profile } from "@/types";
import { TIER_LABELS } from "@/types";
import dayjs from "dayjs";
import { toast } from "sonner";

type TierFilter = "all" | "free" | "basic" | "pro" | "premium" | "bundle";
type RoleFilter = "all" | "user" | "partner" | "admin";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [loading, setLoading] = useState(true);
  const [suspending, setSuspending] = useState<string | null>(null);
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
  }, [supabase]);

  const handleToggleSuspend = async (userId: string, currentSuspended: boolean) => {
    setSuspending(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_suspended: !currentSuspended })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_suspended: !currentSuspended } : u
        )
      );
      toast.success(currentSuspended ? "정지 해제되었습니다" : "유저가 정지되었습니다");
    } catch {
      toast.error("처리 중 오류가 발생했습니다");
    } finally {
      setSuspending(null);
    }
  };

  const filtered = users.filter((u) => {
    if (search && !(
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(search.toLowerCase())
    )) return false;
    if (tierFilter !== "all" && u.subscription_tier !== tierFilter) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    return true;
  });

  const tierOptions: { value: TierFilter; label: string }[] = [
    { value: "all", label: "전체 등급" },
    { value: "free", label: "Free" },
    { value: "basic", label: "Basic" },
    { value: "pro", label: "Pro" },
    { value: "premium", label: "Premium" },
    { value: "bundle", label: "VIP" },
  ];

  const roleOptions: { value: RoleFilter; label: string }[] = [
    { value: "all", label: "전체 역할" },
    { value: "user", label: "유저" },
    { value: "partner", label: "파트너" },
    { value: "admin", label: "관리자" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">유저 관리</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A5]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이메일 또는 이름 검색"
            className="pl-10 bg-[#1A1D26] border-[#2A2D36] text-white"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as TierFilter)}
          className="bg-[#1A1D26] border border-[#2A2D36] text-white text-base rounded-md px-3 py-2.5"
        >
          {tierOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="bg-[#1A1D26] border border-[#2A2D36] text-white text-base rounded-md px-3 py-2.5"
        >
          {roleOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
        {/* Mobile: Card List */}
        <div className="md:hidden space-y-2">
          {filtered.map((user) => (
            <Card key={user.id} className="bg-[#1A1D26] border-[#2A2D36] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{user.display_name}</p>
                  <p className="text-[10px] text-[#8B95A5] truncate">{user.email}</p>
                </div>
                {user.role !== "admin" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={suspending === user.id}
                    onClick={() => handleToggleSuspend(user.id, !!user.is_suspended)}
                    className={user.is_suspended
                      ? "text-green-400 hover:text-green-300 h-7 text-xs shrink-0"
                      : "text-red-400 hover:text-red-300 h-7 text-xs shrink-0"
                    }
                  >
                    {user.is_suspended ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />해제</>
                    ) : (
                      <><Ban className="w-3 h-3 mr-1" />정지</>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={
                  user.role === "admin" ? "border-[#FF5252] text-[#FF5252] text-[10px]"
                    : user.role === "partner" ? "border-[#F5B800] text-[#F5B800] text-[10px]"
                    : "border-[#2A2D36] text-[#8B95A5] text-[10px]"
                }>{user.role}</Badge>
                <Badge className="bg-[#22262F] text-[#8B95A5] border-0 text-[10px]">{TIER_LABELS[user.subscription_tier]}</Badge>
                {user.is_suspended
                  ? <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px]">정지됨</Badge>
                  : <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px]">활성</Badge>
                }
                <span className="text-[10px] text-[#8B95A5]">{dayjs(user.created_at).format("YY.MM.DD")}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop: Table */}
        <Card className="bg-[#1A1D26] border-[#2A2D36] overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2D36]">
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">유저</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">역할</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">구독</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">상태</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">가입일</th>
                  <th className="text-left text-[10px] text-[#8B95A5] uppercase p-3">관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b border-[#2A2D36]/50 hover:bg-[#22262F]">
                    <td className="p-3">
                      <p className="text-sm text-white">{user.display_name}</p>
                      <p className="text-[10px] text-[#8B95A5]">{user.email}</p>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={
                        user.role === "admin" ? "border-[#FF5252] text-[#FF5252] text-[10px]"
                          : user.role === "partner" ? "border-[#F5B800] text-[#F5B800] text-[10px]"
                          : "border-[#2A2D36] text-[#8B95A5] text-[10px]"
                      }>{user.role}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge className="bg-[#22262F] text-[#8B95A5] border-0 text-[10px]">{TIER_LABELS[user.subscription_tier]}</Badge>
                    </td>
                    <td className="p-3">
                      {user.is_suspended
                        ? <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px]">정지됨</Badge>
                        : <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px]">활성</Badge>
                      }
                    </td>
                    <td className="p-3 text-xs text-[#8B95A5]">{dayjs(user.created_at).format("YY.MM.DD")}</td>
                    <td className="p-3">
                      {user.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={suspending === user.id}
                          onClick={() => handleToggleSuspend(user.id, !!user.is_suspended)}
                          className={user.is_suspended
                            ? "text-green-400 hover:text-green-300 h-8 text-xs"
                            : "text-red-400 hover:text-red-300 h-8 text-xs"
                          }
                        >
                          {user.is_suspended ? (
                            <><CheckCircle className="w-3 h-3 mr-1" />해제</>
                          ) : (
                            <><Ban className="w-3 h-3 mr-1" />정지</>
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}
    </div>
  );
}

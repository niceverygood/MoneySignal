"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CommunityWritePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{
    id: string;
    display_name: string;
    role: string;
    subscription_tier: string;
  } | null>(null);

  const [form, setForm] = useState({
    title: "",
    message: "",
    messageType: "discussion",
    signalSymbol: "",
    signalDirection: "",
  });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, role, subscription_tier")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    }
    init();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }
    if (!profile) {
      toast.error("로그인이 필요합니다");
      return;
    }

    setLoading(true);
    try {
      const signalData =
        form.messageType === "signal_share" && form.signalSymbol
          ? { symbol: form.signalSymbol, direction: form.signalDirection }
          : null;

      const { error } = await supabase.from("community_messages").insert({
        user_id: profile.id,
        display_name: profile.display_name || "익명",
        role: profile.role,
        subscription_tier: profile.subscription_tier,
        title: form.title,
        message: form.message,
        message_type: form.messageType,
        signal_data: signalData,
        likes: 0,
        comment_count: 0,
        views: 0,
        is_pinned: false,
      });

      if (error) throw error;

      toast.success("게시글이 등록되었습니다!");
      router.push("/app/community");
    } catch {
      toast.error("등록에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[#8B95A5] -ml-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-bold text-white">글쓰기</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-5 space-y-4">
          <div>
            <Label className="text-[#8B95A5]">카테고리</Label>
            <Select value={form.messageType} onValueChange={(v) => setForm((p) => ({ ...p, messageType: v }))}>
              <SelectTrigger className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                <SelectItem value="discussion">자유토론</SelectItem>
                <SelectItem value="signal_share">시그널 공유</SelectItem>
                <SelectItem value="analysis">분석/전망</SelectItem>
                <SelectItem value="question">질문</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.messageType === "signal_share" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[#8B95A5]">종목</Label>
                <Input
                  value={form.signalSymbol}
                  onChange={(e) => setForm((p) => ({ ...p, signalSymbol: e.target.value }))}
                  placeholder="BTC, 삼성전자 등"
                  className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
                />
              </div>
              <div>
                <Label className="text-[#8B95A5]">방향</Label>
                <Select value={form.signalDirection} onValueChange={(v) => setForm((p) => ({ ...p, signalDirection: v }))}>
                  <SelectTrigger className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1D26] border-[#2A2D36]">
                    <SelectItem value="long">롱 (매수)</SelectItem>
                    <SelectItem value="short">숏 (매도)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-[#8B95A5]">제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              required
            />
          </div>

          <div>
            <Label className="text-[#8B95A5]">내용 *</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="내용을 입력하세요"
              maxLength={2000}
              className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5 min-h-[200px]"
              required
            />
            <p className="text-[10px] text-[#8B95A5] mt-1 text-right">{form.message.length}/2000</p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            등록하기
          </Button>
        </Card>
      </form>
    </div>
  );
}

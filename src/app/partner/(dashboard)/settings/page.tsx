"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { Partner } from "@/types";

export default function PartnerSettingsPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    brandName: "",
    bio: "",
    profileImageUrl: "",
  });
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        const p = data as Partner;
        setPartner(p);
        setForm({
          brandName: p.brand_name,
          bio: p.bio || "",
          profileImageUrl: p.profile_image_url || "",
        });
      }
      setLoading(false);
    }

    fetchData();
  }, [supabase]);

  const handleSave = async () => {
    if (!partner) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("partners")
        .update({
          brand_name: form.brandName,
          bio: form.bio,
          profile_image_url: form.profileImageUrl || null,
        })
        .eq("id", partner.id);

      if (error) throw error;
      toast.success("설정이 저장되었습니다");
    } catch {
      toast.error("저장에 실패했습니다");
    } finally {
      setSaving(false);
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
      <h1 className="text-2xl font-bold text-white">설정</h1>

      <Card className="bg-[#1A1D26] border-[#2A2D36] p-6 space-y-5">
        <div>
          <Label className="text-[#8B95A5]">브랜드명</Label>
          <Input
            value={form.brandName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, brandName: e.target.value }))
            }
            className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
          />
        </div>

        <div>
          <Label className="text-[#8B95A5]">슬러그 (URL)</Label>
          <Input
            value={partner?.brand_slug || ""}
            disabled
            className="bg-[#22262F] border-[#2A2D36] text-[#8B95A5] mt-1.5"
          />
          <p className="text-[10px] text-[#8B95A5] mt-1">
            moneysignal.io/p/{partner?.brand_slug}
          </p>
        </div>

        <div>
          <Label className="text-[#8B95A5]">소개글</Label>
          <Textarea
            value={form.bio}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, bio: e.target.value }))
            }
            placeholder="파트너 소개를 입력하세요"
            className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5 min-h-[120px]"
          />
        </div>

        <div>
          <Label className="text-[#8B95A5]">프로필 이미지 URL</Label>
          <Input
            value={form.profileImageUrl}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                profileImageUrl: e.target.value,
              }))
            }
            placeholder="https://..."
            className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          저장하기
        </Button>
      </Card>
    </div>
  );
}

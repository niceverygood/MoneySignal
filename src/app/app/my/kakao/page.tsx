"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  MessageCircle,
  Bell,
  BellOff,
  Lock,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/types";
import { TIER_LABELS } from "@/types";

interface KakaoConnection {
  id: string;
  kakao_user_id: string;
  kakao_nickname: string | null;
  is_active: boolean;
  notification_settings: {
    new_signal: boolean;
    tp_hit: boolean;
    sl_hit: boolean;
  };
  connected_at: string;
}

export default function KakaoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<SubscriptionTier>("free");
  const [connection, setConnection] = useState<KakaoConnection | null>(null);
  const [saving, setSaving] = useState(false);

  const isKakaoEnabled = ["basic", "pro", "premium", "bundle"].includes(userTier);

  const fetchConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    if (profile) {
      setUserTier(profile.subscription_tier as SubscriptionTier);
    }

    const { data: conn } = await supabase
      .from("kakao_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (conn) {
      setConnection(conn as KakaoConnection);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const handleKakaoConnect = () => {
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/app/my/kakao/callback`;
    const kakaoAuthUrl =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=talk_message,profile_nickname`;
    window.location.href = kakaoAuthUrl;
  };

  const handleToggleSetting = async (key: string, value: boolean) => {
    if (!connection) return;
    setSaving(true);

    const newSettings = { ...connection.notification_settings, [key]: value };

    const { error } = await supabase
      .from("kakao_connections")
      .update({ notification_settings: newSettings, updated_at: new Date().toISOString() })
      .eq("id", connection.id);

    if (!error) {
      setConnection({ ...connection, notification_settings: newSettings });
    }
    setSaving(false);
  };

  const handleToggleActive = async () => {
    if (!connection) return;
    setSaving(true);

    const newActive = !connection.is_active;
    const { error } = await supabase
      .from("kakao_connections")
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq("id", connection.id);

    if (!error) {
      setConnection({ ...connection, is_active: newActive });
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    if (!confirm("카카오 연동을 해제하시겠습니까?")) return;
    setSaving(true);

    await supabase.from("kakao_connections").delete().eq("id", connection.id);
    setConnection(null);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-lg bg-[#1A1D26] flex items-center justify-center text-[#8B95A5] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold text-white">카카오톡 연결</h1>
      </div>

      {/* Lock for free tier */}
      {!isKakaoEnabled && (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#2A2D36] flex items-center justify-center">
              <Lock className="w-7 h-7 text-[#8B95A5]" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">Basic 이상에서 이용 가능</p>
              <p className="text-[#8B95A5] text-sm mt-1">
                카카오톡 알림은 Basic, Pro, Premium, Bundle 구독자에게 제공됩니다.
              </p>
            </div>
            <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-xs">
              현재: {TIER_LABELS[userTier]}
            </Badge>
            <Button
              onClick={() => router.push("/app/subscribe")}
              className="mt-2 bg-[#F5B800] hover:bg-[#D4A000] text-[#0D0F14] font-semibold"
            >
              구독 업그레이드
            </Button>
          </div>
        </Card>
      )}

      {/* Connected state */}
      {isKakaoEnabled && connection && (
        <>
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FEE500]/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#FEE500]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold">카카오톡 연결됨</p>
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      connection.is_active ? "bg-[#00E676]" : "bg-[#8B95A5]"
                    )}
                  />
                </div>
                <p className="text-xs text-[#8B95A5]">
                  {connection.kakao_nickname ? `${connection.kakao_nickname}님` : "연결된 계정"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleActive}
                disabled={saving}
                className={cn(
                  "text-xs px-3",
                  connection.is_active
                    ? "text-[#00E676] hover:text-[#00E676] hover:bg-[#00E676]/10"
                    : "text-[#8B95A5] hover:text-white hover:bg-[#2A2D36]"
                )}
              >
                {connection.is_active ? (
                  <><Bell className="w-3.5 h-3.5 mr-1" /> 활성</>
                ) : (
                  <><BellOff className="w-3.5 h-3.5 mr-1" /> 비활성</>
                )}
              </Button>
            </div>

            <div className="text-xs text-[#8B95A5] pt-3 border-t border-[#2A2D36]">
              연결일: {new Date(connection.connected_at).toLocaleDateString("ko-KR")}
            </div>
          </Card>

          {/* Notification settings */}
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4 space-y-4">
            <h2 className="text-sm font-semibold text-white">알림 설정</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">새 시그널</p>
                <p className="text-xs text-[#8B95A5]">AI 시그널 발행 시 카카오 알림</p>
              </div>
              <Switch
                checked={connection.notification_settings.new_signal}
                onCheckedChange={(v) => handleToggleSetting("new_signal", v)}
                disabled={saving || !connection.is_active}
                className="data-[state=checked]:bg-[#FEE500]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">TP/SL 도달</p>
                <p className="text-xs text-[#8B95A5]">익절·손절 도달 시 카카오 알림</p>
              </div>
              <Switch
                checked={connection.notification_settings.tp_hit}
                onCheckedChange={(v) => handleToggleSetting("tp_hit", v)}
                disabled={saving || !connection.is_active}
                className="data-[state=checked]:bg-[#FEE500]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">SL(손절) 전용 알림</p>
                <p className="text-xs text-[#8B95A5]">손절 도달 시 별도 카카오 알림</p>
              </div>
              <Switch
                checked={connection.notification_settings.sl_hit}
                onCheckedChange={(v) => handleToggleSetting("sl_hit", v)}
                disabled={saving || !connection.is_active}
                className="data-[state=checked]:bg-[#FEE500]"
              />
            </div>
          </Card>

          <Button
            variant="ghost"
            onClick={handleDisconnect}
            disabled={saving}
            className="w-full text-[#FF5252] hover:text-[#FF5252] hover:bg-[#FF5252]/5 text-sm"
          >
            카카오 연동 해제
          </Button>
        </>
      )}

      {/* Not connected */}
      {isKakaoEnabled && !connection && (
        <>
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FEE500]/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#FEE500]" />
              </div>
              <div>
                <p className="text-white font-semibold">카카오톡으로 알림 받기</p>
                <p className="text-xs text-[#8B95A5]">
                  AI 시그널을 카카오톡 메시지로 수신
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-[#8B95A5] mb-4">
              <div className="flex gap-2">
                <span className="text-[#FEE500] font-semibold shrink-0">1.</span>
                <span>아래 버튼으로 카카오 로그인</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#FEE500] font-semibold shrink-0">2.</span>
                <span>메시지 수신 권한 허용</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#FEE500] font-semibold shrink-0">3.</span>
                <span>연동 완료 — 시그널 발행 시 즉시 카카오 알림</span>
              </div>
            </div>

            <div className="p-3 bg-[#22262F] rounded-lg text-[11px] text-[#8B95A5]">
              <span className="text-[#FEE500] font-medium">안내:</span> 나에게 보내기 방식으로
              발송됩니다. 카카오 채널 메시지가 아닌 개인 메시지 수신함으로 알림이 전달됩니다.
            </div>
          </Card>

          <Button
            onClick={handleKakaoConnect}
            className="w-full bg-[#FEE500] hover:bg-[#FFD700] text-[#3C1E1E] font-bold h-12 text-base"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            카카오 연동하기
          </Button>
        </>
      )}
    </div>
  );
}

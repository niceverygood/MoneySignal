"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Copy,
  Check,
  MessageCircle,
  Bell,
  BellOff,
  Lock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/types";
import { TIER_LABELS } from "@/types";

interface TelegramConnection {
  id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  is_active: boolean;
  notification_settings: {
    new_signal: boolean;
    tp_hit: boolean;
    sl_hit: boolean;
    daily_summary: boolean;
  };
  connected_at: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function TelegramPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<SubscriptionTier>("free");
  const [connection, setConnection] = useState<TelegramConnection | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTelegramEnabled = ["pro", "premium", "bundle"].includes(userTier);

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
      .from("telegram_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (conn) {
      setConnection(conn as TelegramConnection);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  // Countdown timer
  useEffect(() => {
    if (!codeExpiry) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((codeExpiry.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setLinkCode(null);
        setCodeExpiry(null);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [codeExpiry]);

  // Poll for connection while code is active
  useEffect(() => {
    if (!linkCode || connection) return;

    pollRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: conn } = await supabase
        .from("telegram_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (conn) {
        setConnection(conn as TelegramConnection);
        setLinkCode(null);
        setCodeExpiry(null);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [linkCode, connection, supabase]);

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Invalidate old codes
      await supabase
        .from("telegram_link_codes")
        .update({ used: true })
        .eq("user_id", user.id)
        .eq("used", false);

      // Insert new code
      const { error } = await supabase
        .from("telegram_link_codes")
        .insert({
          code,
          user_id: user.id,
          expires_at: expiresAt.toISOString(),
          used: false,
        });

      if (error) {
        console.error("Failed to generate code:", error);
        return;
      }

      setLinkCode(code);
      setCodeExpiry(expiresAt);
      setTimeLeft(300);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!linkCode) return;
    await navigator.clipboard.writeText(linkCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSetting = async (key: string, value: boolean) => {
    if (!connection) return;
    setSaving(true);

    const newSettings = { ...connection.notification_settings, [key]: value };

    const { error } = await supabase
      .from("telegram_connections")
      .update({
        notification_settings: newSettings,
        updated_at: new Date().toISOString(),
      })
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
      .from("telegram_connections")
      .update({
        is_active: newActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    if (!error) {
      setConnection({ ...connection, is_active: newActive });
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    setSaving(true);

    await supabase
      .from("telegram_connections")
      .delete()
      .eq("id", connection.id);

    setConnection(null);
    setSaving(false);
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
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
        <h1 className="text-lg font-bold text-white">텔레그램 연결</h1>
      </div>

      {/* Lock overlay for non-pro */}
      {!isTelegramEnabled && (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-6 relative overflow-hidden">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#2A2D36] flex items-center justify-center">
              <Lock className="w-7 h-7 text-[#8B95A5]" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">
                Pro 이상에서 이용 가능
              </p>
              <p className="text-[#8B95A5] text-sm mt-1">
                텔레그램 알림은 Pro, Premium, Bundle 구독자에게 제공됩니다.
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
      {isTelegramEnabled && connection && (
        <>
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#0088cc]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold">텔레그램 연결됨</p>
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      connection.is_active ? "bg-[#00E676]" : "bg-[#8B95A5]"
                    )}
                  />
                </div>
                <p className="text-xs text-[#8B95A5]">
                  {connection.telegram_username
                    ? `@${connection.telegram_username}`
                    : `Chat ID: ${connection.telegram_chat_id}`}
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

            <NotificationToggle
              label="새 시그널"
              description="새로운 AI 시그널 발생 시 알림"
              checked={connection.notification_settings.new_signal}
              onCheckedChange={(v) => handleToggleSetting("new_signal", v)}
              disabled={saving || !connection.is_active}
            />
            <NotificationToggle
              label="TP 도달"
              description="익절 목표가 도달 시 알림"
              checked={connection.notification_settings.tp_hit}
              onCheckedChange={(v) => handleToggleSetting("tp_hit", v)}
              disabled={saving || !connection.is_active}
            />
            <NotificationToggle
              label="SL 도달"
              description="손절가 도달 시 알림"
              checked={connection.notification_settings.sl_hit}
              onCheckedChange={(v) => handleToggleSetting("sl_hit", v)}
              disabled={saving || !connection.is_active}
            />
            <NotificationToggle
              label="일일 요약"
              description="매일 시그널 성과 리포트"
              checked={connection.notification_settings.daily_summary}
              onCheckedChange={(v) => handleToggleSetting("daily_summary", v)}
              disabled={saving || !connection.is_active}
            />
          </Card>

          {/* Disconnect */}
          <Button
            variant="ghost"
            onClick={handleDisconnect}
            disabled={saving}
            className="w-full text-[#FF5252] hover:text-[#FF5252] hover:bg-[#FF5252]/5 text-sm"
          >
            텔레그램 연결 해제
          </Button>
        </>
      )}

      {/* Not connected - show code generation */}
      {isTelegramEnabled && !connection && (
        <>
          <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#0088cc]" />
              </div>
              <div>
                <p className="text-white font-semibold">텔레그램으로 알림 받기</p>
                <p className="text-xs text-[#8B95A5]">
                  AI 시그널을 텔레그램으로 실시간 알림
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-[#8B95A5]">
              <div className="flex gap-2">
                <span className="text-[#F5B800] font-semibold shrink-0">1.</span>
                <span>
                  텔레그램에서{" "}
                  <span className="text-[#0088cc] font-medium">@moneysignal_bot</span>
                  을 검색
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#F5B800] font-semibold shrink-0">2.</span>
                <span>/start 명령어 전송</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#F5B800] font-semibold shrink-0">3.</span>
                <span>아래 코드를 봇에게 입력</span>
              </div>
            </div>
          </Card>

          {/* Code display */}
          {linkCode ? (
            <Card className="bg-[#1A1D26] border-[#F5B800]/30 p-5">
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-[#8B95A5] uppercase tracking-wider">
                  연결 코드
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-mono font-bold text-[#F5B800] tracking-[0.3em]">
                    {linkCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="w-9 h-9 rounded-lg bg-[#2A2D36] flex items-center justify-center text-[#8B95A5] hover:text-white transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#00E676]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      timeLeft > 60 ? "bg-[#00E676]" : "bg-[#FF5252]"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-mono",
                      timeLeft > 60 ? "text-[#8B95A5]" : "text-[#FF5252]"
                    )}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <p className="text-xs text-[#8B95A5] text-center">
                  이 코드를 텔레그램 봇에 입력하세요.
                  <br />
                  연결되면 자동으로 화면이 업데이트됩니다.
                </p>
              </div>
            </Card>
          ) : (
            <Button
              onClick={handleGenerateCode}
              disabled={generatingCode}
              className="w-full bg-[#F5B800] hover:bg-[#D4A000] text-[#0D0F14] font-semibold h-12"
            >
              {generatingCode ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4 mr-2" />
              )}
              연결 코드 발급
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function NotificationToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-[#8B95A5]">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="data-[state=checked]:bg-[#F5B800]"
      />
    </div>
  );
}

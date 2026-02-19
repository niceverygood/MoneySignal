"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, TrendingUp, TrendingDown, CreditCard, Megaphone,
  Check, Clock, ChevronRight, Lock, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import { TIER_CONFIG } from "@/lib/tier-access";
import type { TierKey } from "@/lib/tier-access";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";

dayjs.extend(relativeTime);
dayjs.locale("ko");

interface SignalNotification {
  id: string;
  category: string;
  symbol: string;
  symbol_name: string;
  direction: string;
  status: string;
  result_pnl_percent: number | null;
  confidence: number;
  created_at: string;
  closed_at: string | null;
}

const typeIcons: Record<string, typeof TrendingUp> = {
  signal: TrendingUp,
  subscription: CreditCard,
  payout: CreditCard,
  system: Megaphone,
};

const typeColors: Record<string, string> = {
  signal: "text-[#F5B800]",
  subscription: "text-[#00E676]",
  payout: "text-[#448AFF]",
  system: "text-[#E040FB]",
};

const CATEGORY_LABELS: Record<string, string> = {
  coin_spot: "코인 현물",
  coin_futures: "코인 선물",
  overseas_futures: "해외선물",
  kr_stock: "국내주식",
};

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [signals, setSignals] = useState<SignalNotification[]>([]);
  const [userTier, setUserTier] = useState<TierKey>("free");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"signals" | "notifications">("signals");

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user tier
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      if (profile) setUserTier((profile.subscription_tier || "free") as TierKey);

      // Fetch notifications
      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (notifData) setNotifications(notifData as Notification[]);

      // Fetch recent signals (as signal log)
      const { data: signalData } = await supabase
        .from("signals")
        .select("id, category, symbol, symbol_name, direction, status, result_pnl_percent, confidence, created_at, closed_at")
        .order("created_at", { ascending: false })
        .limit(30);

      if (signalData) setSignals(signalData as SignalNotification[]);
      setLoading(false);
    }

    fetchData();
  }, [supabase]);

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const tierConfig = TIER_CONFIG[userTier];
  const accessibleCategories = tierConfig.categories as readonly string[];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Tier-based signal limits
  const tierSignalInfo = {
    free: { label: "무료", daily: 0, delay: "접근 불가", color: "text-[#8B95A5]" },
    basic: { label: "Basic", daily: 3, delay: "30분 딜레이", color: "text-[#448AFF]" },
    pro: { label: "Pro", daily: 10, delay: "10분 딜레이", color: "text-[#F5B800]" },
    premium: { label: "Premium", daily: "∞", delay: "실시간", color: "text-[#E040FB]" },
    bundle: { label: "Bundle", daily: "∞", delay: "1시간 선공개", color: "text-[#00E676]" },
  };
  const currentInfo = tierSignalInfo[userTier];

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">알림</h1>
        {tab === "notifications" && unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="text-[#F5B800] text-xs">
            <Check className="w-3.5 h-3.5 mr-1" /> 모두 읽음
          </Button>
        )}
      </div>

      {/* Tier info banner */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <div className="flex items-center gap-2">
          <Badge className={cn("border-0 text-[10px]",
            userTier === "free" ? "bg-[#8B95A5]/10 text-[#8B95A5]" : "bg-[#F5B800]/10 text-[#F5B800]"
          )}>
            <Crown className="w-3 h-3 mr-0.5" /> {currentInfo.label}
          </Badge>
          <span className="text-[10px] text-[#8B95A5]">
            일 {currentInfo.daily}개 · {currentInfo.delay}
          </span>
        </div>
        {userTier !== "premium" && userTier !== "bundle" && (
          <Button size="sm" onClick={() => router.push("/app/subscribe")}
            className="bg-[#F5B800] text-[#0D0F14] text-[10px] h-6 px-2 hover:bg-[#FFD54F]">
            업그레이드
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("signals")}
          className={cn("px-4 py-2 rounded-full text-xs font-medium transition-all",
            tab === "signals" ? "bg-[#F5B800] text-[#0D0F14]" : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
          )}
        >
          시그널 로그
        </button>
        <button
          onClick={() => setTab("notifications")}
          className={cn("px-4 py-2 rounded-full text-xs font-medium transition-all relative",
            tab === "notifications" ? "bg-[#F5B800] text-[#0D0F14]" : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
          )}
        >
          알림
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF5252] text-white text-[9px] flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === "signals" ? (
        /* === Signal Log === */
        <div className="space-y-2">
          {signals.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 text-[#2A2D36] mx-auto mb-3" />
              <p className="text-[#8B95A5]">시그널 기록이 없습니다</p>
            </div>
          ) : (
            signals.map((signal) => {
              const isLong = signal.direction === "long" || signal.direction === "buy";
              const isCompleted = signal.status !== "active";
              const pnl = Number(signal.result_pnl_percent || 0);
              const isWin = pnl > 0;
              const isAccessible = accessibleCategories.includes(signal.category);
              const timeDiff = dayjs().diff(dayjs(signal.created_at), "minute");
              const delayMin = tierConfig.delayMinutes === Infinity ? 9999 : tierConfig.delayMinutes;
              const isDelayed = !isCompleted && delayMin > 0 && timeDiff < delayMin;

              return (
                <Card
                  key={signal.id}
                  className={cn(
                    "bg-[#1A1D26] border-[#2A2D36] p-3 cursor-pointer hover:border-[#3A3D46] transition-all",
                    signal.status === "active" && "border-l-2 border-l-[#00E676]",
                    isCompleted && isWin && "border-l-2 border-l-[#00E676]/50",
                    isCompleted && !isWin && "border-l-2 border-l-[#FF5252]/50",
                  )}
                  onClick={() => {
                    if (isAccessible && !isDelayed) {
                      router.push(`/app/signals/${signal.id}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Time */}
                    <div className="text-center shrink-0 w-12">
                      <p className="text-[10px] text-[#8B95A5]">
                        {dayjs(signal.created_at).format("M/DD")}
                      </p>
                      <p className="text-xs font-mono text-white">
                        {dayjs(signal.created_at).format("HH:mm")}
                      </p>
                    </div>

                    {/* Signal info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white">{signal.symbol_name}</span>
                        <Badge className={cn("text-[8px] px-1 py-0 border-0",
                          isLong ? "bg-[#00E676]/10 text-[#00E676]" : "bg-[#FF5252]/10 text-[#FF5252]"
                        )}>
                          {isLong ? <TrendingUp className="w-2.5 h-2.5 mr-0.5 inline" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5 inline" />}
                          {signal.direction.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-[#2A2D36] text-[#8B95A5]">
                          {CATEGORY_LABELS[signal.category] || signal.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#8B95A5]">
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {dayjs(signal.created_at).fromNow()}
                        </span>
                        {signal.status === "active" && (
                          <Badge className="bg-[#00E676]/10 text-[#00E676] border-0 text-[8px] px-1 py-0">진행중</Badge>
                        )}
                      </div>
                    </div>

                    {/* Result or Lock */}
                    <div className="shrink-0 text-right">
                      {!isAccessible ? (
                        <div className="flex items-center gap-1 text-[#8B95A5]/40">
                          <Lock className="w-3.5 h-3.5" />
                          <span className="text-[9px]">잠금</span>
                        </div>
                      ) : isDelayed ? (
                        <div className="flex items-center gap-1 text-[#F5B800]">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[9px]">{delayMin - timeDiff}분 후</span>
                        </div>
                      ) : isCompleted ? (
                        <div>
                          <span className={cn("text-sm font-bold font-mono",
                            isWin ? "text-[#00E676]" : "text-[#FF5252]"
                          )}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                          </span>
                          <p className="text-[9px] text-[#8B95A5]">
                            {signal.status === "hit_tp1" ? "TP1" :
                             signal.status === "hit_tp2" ? "TP2" :
                             signal.status === "hit_tp3" ? "TP3" :
                             signal.status === "hit_sl" ? "SL" :
                             signal.status === "expired" ? "만료" : signal.status}
                          </p>
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#8B95A5]" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* === Notifications === */
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 text-[#2A2D36] mx-auto mb-3" />
              <p className="text-[#8B95A5]">알림이 없습니다</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Bell;
              const color = typeColors[notification.type] || "text-[#8B95A5]";
              const signalId = (notification.data as Record<string, string> | null)?.signal_id;

              return (
                <Card
                  key={notification.id}
                  className={cn(
                    "bg-[#1A1D26] border-[#2A2D36] p-3 transition-all",
                    !notification.is_read && "border-l-2 border-l-[#F5B800]",
                    signalId && "cursor-pointer hover:border-[#3A3D46]"
                  )}
                  onClick={() => {
                    if (signalId) router.push(`/app/signals/${signalId}`);
                  }}
                >
                  <div className="flex gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      !notification.is_read ? "bg-[#F5B800]/10" : "bg-[#2A2D36]"
                    )}>
                      <Icon className={cn("w-4 h-4", color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium",
                        !notification.is_read ? "text-white" : "text-[#8B95A5]"
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-[#8B95A5] mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-[10px] text-[#8B95A5]/60 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dayjs(notification.created_at).format("MM.DD HH:mm")}
                        <span className="mx-1">·</span>
                        {dayjs(notification.created_at).fromNow()}
                      </p>
                    </div>
                    {signalId && <ChevronRight className="w-4 h-4 text-[#8B95A5] shrink-0 self-center" />}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

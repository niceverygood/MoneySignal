"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, TrendingUp, CreditCard, Megaphone, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

const typeIcons = {
  signal: TrendingUp,
  subscription: CreditCard,
  payout: CreditCard,
  system: Megaphone,
};

const typeColors = {
  signal: "text-[#F5B800]",
  subscription: "text-[#00E676]",
  payout: "text-[#448AFF]",
  system: "text-[#E040FB]",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setNotifications((data as Notification[]) || []);
      setLoading(false);
    }

    fetchNotifications();
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">알림</h1>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            className="text-[#F5B800] text-xs"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            모두 읽음
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-[#2A2D36] mx-auto mb-3" />
          <p className="text-[#8B95A5]">알림이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const Icon = typeIcons[notification.type] || Bell;
            const color = typeColors[notification.type] || "text-[#8B95A5]";

            return (
              <Card
                key={notification.id}
                className={cn(
                  "bg-[#1A1D26] border-[#2A2D36] p-3",
                  !notification.is_read && "border-l-2 border-l-[#F5B800]"
                )}
              >
                <div className="flex gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      !notification.is_read
                        ? "bg-[#F5B800]/10"
                        : "bg-[#2A2D36]"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        !notification.is_read ? "text-white" : "text-[#8B95A5]"
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-xs text-[#8B95A5] mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-[10px] text-[#8B95A5]/60 mt-1">
                      {dayjs(notification.created_at).format(
                        "MM.DD HH:mm"
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

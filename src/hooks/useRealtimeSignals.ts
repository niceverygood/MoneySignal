"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/stores/useStore";
import { toast } from "sonner";
import type { Signal, Notification } from "@/types";

export function useRealtimeSignals() {
  const { profile, addSignal, updateSignal, addNotification } = useStore();
  const supabase = createClient();

  const playSound = useCallback(() => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Audio not available
    }
  }, []);

  useEffect(() => {
    // Subscribe to new signals
    const signalsChannel = supabase
      .channel("realtime-signals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => {
          const newSignal = payload.new as Signal;
          addSignal(newSignal);

          // Show toast notification
          const directionLabel =
            newSignal.direction === "long" || newSignal.direction === "buy"
              ? "🟢 매수"
              : "🔴 매도";

          toast.success(`새 시그널: ${newSignal.symbol_name}`, {
            description: `${directionLabel} · 진입가 ${Number(newSignal.entry_price).toLocaleString()}`,
            duration: 8000,
          });

          playSound();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "signals" },
        (payload) => {
          const updated = payload.new as Signal;
          const old = payload.old as Partial<Signal>;

          updateSignal(updated.id, updated);

          // Notify status changes
          if (old.status === "active" && updated.status !== "active") {
            const pnl = Number(updated.result_pnl_percent || 0);
            const isProfit = pnl >= 0;

            let title = "";
            switch (updated.status) {
              case "hit_tp1":
                title = `🎯 ${updated.symbol_name} +${pnl.toFixed(1)}% 1차 익절 도달!`;
                break;
              case "hit_tp2":
                title = `🎯🎯 ${updated.symbol_name} +${pnl.toFixed(1)}% 2차 익절 도달!`;
                break;
              case "hit_tp3":
                title = `🎯🎯🎯 ${updated.symbol_name} +${pnl.toFixed(1)}% 3차 익절 도달!`;
                break;
              case "hit_sl":
                title = `⚠️ ${updated.symbol_name} ${pnl.toFixed(1)}% 손절 도달`;
                break;
              case "expired":
                title = `⏰ ${updated.symbol_name} 시그널 만료`;
                break;
            }

            if (title) {
              if (isProfit) {
                toast.success(title, { duration: 10000 });
              } else {
                toast.error(title, { duration: 10000 });
              }
              playSound();
            }
          }
        }
      )
      .subscribe();

    // Subscribe to notifications
    const notificationsChannel = profile?.id
      ? supabase
          .channel("realtime-notifications")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${profile.id}`,
            },
            (payload) => {
              const notification = payload.new as Notification;
              addNotification(notification);

              toast.info(notification.title, {
                description: notification.body,
                duration: 5000,
              });
            }
          )
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(signalsChannel);
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
    };
  }, [supabase, profile?.id, addSignal, updateSignal, addNotification, playSound]);
}

"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  TrendingUp,
  TrendingDown,
  Crown,
  Pin,
  ThumbsUp,
  MessageSquare,
  Flame,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";

dayjs.extend(relativeTime);
dayjs.locale("ko");

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  subscription_tier: string;
  message: string;
  message_type: "chat" | "signal_share" | "system";
  signal_data?: {
    symbol: string;
    direction: string;
    reasoning: string;
  };
  likes: number;
  is_pinned: boolean;
  created_at: string;
}

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  free: { label: "", color: "" },
  basic: { label: "Basic", color: "bg-[#448AFF]/10 text-[#448AFF]" },
  pro: { label: "Pro", color: "bg-[#F5B800]/10 text-[#F5B800]" },
  premium: { label: "Premium", color: "bg-[#E040FB]/10 text-[#E040FB]" },
  bundle: { label: "VIP", color: "bg-[#00E676]/10 text-[#00E676]" },
};

const AVATAR_COLORS = [
  "bg-[#F5B800]", "bg-[#00E676]", "bg-[#448AFF]",
  "bg-[#E040FB]", "bg-[#FF5252]", "bg-[#00BCD4]",
];

export default function CommunityPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    display_name: string;
    role: string;
    subscription_tier: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Fetch messages and user profile
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, role, subscription_tier")
        .eq("id", user.id)
        .single();

      if (profile) setUserProfile(profile);

      // Get recent messages
      const { data: msgs } = await supabase
        .from("community_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);

      if (msgs) setMessages(msgs as ChatMessage[]);
      setLoading(false);
    }

    init();
  }, [supabase]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("community-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !userProfile) return;

    setSending(true);
    try {
      const { error } = await supabase.from("community_messages").insert({
        user_id: userProfile.id,
        display_name: userProfile.display_name || "익명",
        role: userProfile.role,
        subscription_tier: userProfile.subscription_tier,
        message: newMessage.trim(),
        message_type: "chat",
        likes: 0,
        is_pinned: false,
      });

      if (error) {
        // Table might not exist yet
        if (error.code === "42P01") {
          toast.error("커뮤니티 테이블을 설정 중입니다.");
        } else {
          toast.error("메시지 전송에 실패했습니다");
        }
        return;
      }
      setNewMessage("");
    } catch {
      toast.error("메시지 전송에 실패했습니다");
    } finally {
      setSending(false);
    }
  };

  const handleLike = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    await supabase
      .from("community_messages")
      .update({ likes: msg.likes + 1 })
      .eq("id", messageId);

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, likes: m.likes + 1 } : m))
    );
  };

  const getAvatarColor = (name: string) => {
    const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#F5B800]" />
            커뮤니티
          </h1>
          <p className="text-[10px] text-[#8B95A5]">
            트레이더들과 실시간 소통하세요
          </p>
        </div>
        <Badge className="bg-[#00E676]/10 text-[#00E676] border-0 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] mr-1 animate-pulse" />
          {messages.length > 0 ? "LIVE" : "대기"}
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-[#2A2D36] mx-auto mb-3" />
            <p className="text-[#8B95A5] text-sm">아직 메시지가 없습니다</p>
            <p className="text-[#8B95A5]/60 text-xs mt-1">
              첫 번째 메시지를 남겨보세요!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === userProfile?.id;
            const isAdmin = msg.role === "admin";
            const isPartner = msg.role === "partner";
            const tierBadge = TIER_BADGES[msg.subscription_tier];

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2.5",
                  isMe && "flex-row-reverse",
                  msg.is_pinned && "bg-[#F5B800]/5 -mx-4 px-4 py-2 rounded-lg"
                )}
              >
                {/* Avatar */}
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-bold text-[#0D0F14]",
                      isAdmin
                        ? "bg-[#FF5252]"
                        : isPartner
                          ? "bg-[#F5B800]"
                          : getAvatarColor(msg.display_name)
                    )}
                  >
                    {isAdmin ? "👑" : (msg.display_name || "?").substring(0, 1)}
                  </AvatarFallback>
                </Avatar>

                {/* Bubble */}
                <div className={cn("max-w-[75%]", isMe && "items-end")}>
                  {/* Name + badges */}
                  <div className={cn("flex items-center gap-1.5 mb-0.5", isMe && "flex-row-reverse")}>
                    <span className={cn(
                      "text-[11px] font-medium",
                      isAdmin ? "text-[#FF5252]" : isPartner ? "text-[#F5B800]" : "text-[#8B95A5]"
                    )}>
                      {msg.display_name}
                    </span>
                    {isAdmin && (
                      <Badge className="bg-[#FF5252]/10 text-[#FF5252] border-0 text-[8px] px-1 py-0">
                        <Crown className="w-2.5 h-2.5 mr-0.5" />관리자
                      </Badge>
                    )}
                    {isPartner && (
                      <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-[8px] px-1 py-0">
                        운영자
                      </Badge>
                    )}
                    {tierBadge.label && (
                      <Badge className={cn("border-0 text-[8px] px-1 py-0", tierBadge.color)}>
                        {tierBadge.label}
                      </Badge>
                    )}
                  </div>

                  {/* Message body */}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm",
                      isMe
                        ? "bg-[#F5B800] text-[#0D0F14] rounded-br-sm"
                        : isAdmin
                          ? "bg-[#FF5252]/10 border border-[#FF5252]/20 text-white rounded-bl-sm"
                          : "bg-[#1A1D26] border border-[#2A2D36] text-[#E0E0E0] rounded-bl-sm"
                    )}
                  >
                    {/* Signal share */}
                    {msg.message_type === "signal_share" && msg.signal_data && (
                      <div className="mb-1.5 p-1.5 rounded bg-[#0D0F14]/30 text-xs">
                        <span className="font-bold">{msg.signal_data.symbol}</span>
                        <Badge className={cn(
                          "ml-1 text-[8px] border-0",
                          msg.signal_data.direction === "long" || msg.signal_data.direction === "buy"
                            ? "bg-[#00E676]/20 text-[#00E676]"
                            : "bg-[#FF5252]/20 text-[#FF5252]"
                        )}>
                          {msg.signal_data.direction === "long" || msg.signal_data.direction === "buy" ? (
                            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                          ) : (
                            <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                          )}
                          {msg.signal_data.direction.toUpperCase()}
                        </Badge>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>

                  {/* Footer: time + likes */}
                  <div className={cn("flex items-center gap-2 mt-0.5", isMe && "flex-row-reverse")}>
                    <span className="text-[10px] text-[#8B95A5]/60">
                      {dayjs(msg.created_at).fromNow()}
                    </span>
                    {!isMe && (
                      <button
                        onClick={() => handleLike(msg.id)}
                        className="flex items-center gap-0.5 text-[10px] text-[#8B95A5] hover:text-[#F5B800] transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {msg.likes > 0 && msg.likes}
                      </button>
                    )}
                    {msg.is_pinned && (
                      <Pin className="w-3 h-3 text-[#F5B800]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#2A2D36] pt-3 pb-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="메시지를 입력하세요..."
            maxLength={500}
            className="bg-[#1A1D26] border-[#2A2D36] text-white flex-1"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] px-3 shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

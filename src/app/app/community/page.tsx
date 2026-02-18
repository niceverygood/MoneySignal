"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Pencil,
  MessageSquare,
  ThumbsUp,
  Eye,
  Pin,
  Crown,
  Flame,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";

dayjs.extend(relativeTime);
dayjs.locale("ko");

interface Post {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  subscription_tier: string;
  title: string;
  message: string;
  message_type: "discussion" | "signal_share" | "question" | "analysis";
  signal_data: { symbol?: string; direction?: string; pnl?: number } | null;
  likes: number;
  comment_count: number;
  views: number;
  is_pinned: boolean;
  created_at: string;
}

const CATEGORY_TABS = [
  { key: "all", label: "전체" },
  { key: "discussion", label: "자유토론" },
  { key: "signal_share", label: "시그널공유" },
  { key: "analysis", label: "분석/전망" },
  { key: "question", label: "질문" },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  discussion: { label: "자유", color: "bg-[#448AFF]/10 text-[#448AFF]" },
  signal_share: { label: "시그널", color: "bg-[#00E676]/10 text-[#00E676]" },
  analysis: { label: "분석", color: "bg-[#F5B800]/10 text-[#F5B800]" },
  question: { label: "질문", color: "bg-[#E040FB]/10 text-[#E040FB]" },
};

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
  const router = useRouter();
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("all");

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel("community-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages" }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchPosts() {
    const { data } = await supabase
      .from("community_messages")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setPosts(data as Post[]);
    setLoading(false);
  }

  const filtered = selectedTab === "all"
    ? posts
    : posts.filter((p) => p.message_type === selectedTab);

  const pinnedPosts = filtered.filter((p) => p.is_pinned);
  const regularPosts = filtered.filter((p) => !p.is_pinned);

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#F5B800]" />
            커뮤니티
          </h1>
          <p className="text-[10px] text-[#8B95A5]">트레이더들과 정보를 나누세요</p>
        </div>
        <Button
          onClick={() => router.push("/app/community/write")}
          className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold text-xs h-9"
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          글쓰기
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              selectedTab === tab.key
                ? "bg-[#F5B800] text-[#0D0F14]"
                : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 text-[#2A2D36] mx-auto mb-3" />
          <p className="text-[#8B95A5]">아직 게시글이 없습니다</p>
          <p className="text-xs text-[#8B95A5]/60 mt-1">첫 번째 글을 작성해보세요!</p>
          <Button
            onClick={() => router.push("/app/community/write")}
            className="mt-4 bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
          >
            글쓰기
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Pinned posts */}
          {pinnedPosts.map((post) => (
            <PostCard key={post.id} post={post} onClick={() => router.push(`/app/community/${post.id}`)} />
          ))}

          {/* Regular posts */}
          {regularPosts.map((post) => (
            <PostCard key={post.id} post={post} onClick={() => router.push(`/app/community/${post.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  const isAdmin = post.role === "admin";
  const isPartner = post.role === "partner";
  const tierBadge = TIER_BADGES[post.subscription_tier];
  const typeBadge = TYPE_LABELS[post.message_type] || TYPE_LABELS.discussion;
  const avatarColor = AVATAR_COLORS[post.display_name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <Card
      className={cn(
        "bg-[#1A1D26] border-[#2A2D36] p-3.5 cursor-pointer hover:border-[#3A3D46] transition-all",
        post.is_pinned && "border-l-2 border-l-[#F5B800]"
      )}
      onClick={onClick}
    >
      {/* Top row: badges + time */}
      <div className="flex items-center gap-1.5 mb-2">
        {post.is_pinned && (
          <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-[8px] px-1.5 py-0">
            <Pin className="w-2.5 h-2.5 mr-0.5" /> 고정
          </Badge>
        )}
        <Badge className={cn("border-0 text-[8px] px-1.5 py-0", typeBadge.color)}>
          {typeBadge.label}
        </Badge>
        {post.message_type === "signal_share" && post.signal_data?.symbol && (
          <Badge className={cn(
            "border-0 text-[8px] px-1.5 py-0",
            post.signal_data.direction === "long" || post.signal_data.direction === "buy"
              ? "bg-[#00E676]/10 text-[#00E676]"
              : "bg-[#FF5252]/10 text-[#FF5252]"
          )}>
            {post.signal_data.symbol}{" "}
            {post.signal_data.direction === "long" || post.signal_data.direction === "buy" ? (
              <TrendingUp className="w-2.5 h-2.5 ml-0.5 inline" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5 ml-0.5 inline" />
            )}
          </Badge>
        )}
        <span className="text-[10px] text-[#8B95A5]/60 ml-auto">
          {dayjs(post.created_at).fromNow()}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white mb-1.5 line-clamp-1">
        {post.title || post.message.substring(0, 50)}
      </h3>

      {/* Preview */}
      <p className="text-xs text-[#8B95A5] line-clamp-2 mb-3">
        {post.message.substring(0, 120)}
      </p>

      {/* Bottom row: author + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-5 h-5">
            <AvatarFallback className={cn("text-[8px] font-bold text-[#0D0F14]", isAdmin ? "bg-[#FF5252]" : isPartner ? "bg-[#F5B800]" : avatarColor)}>
              {isAdmin ? "👑" : (post.display_name || "?")[0]}
            </AvatarFallback>
          </Avatar>
          <span className={cn(
            "text-[10px] font-medium",
            isAdmin ? "text-[#FF5252]" : isPartner ? "text-[#F5B800]" : "text-[#8B95A5]"
          )}>
            {post.display_name}
          </span>
          {isAdmin && <Badge className="bg-[#FF5252]/10 text-[#FF5252] border-0 text-[7px] px-1 py-0"><Crown className="w-2 h-2 mr-0.5" />관리자</Badge>}
          {isPartner && <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-[7px] px-1 py-0">운영자</Badge>}
          {tierBadge.label && <Badge className={cn("border-0 text-[7px] px-1 py-0", tierBadge.color)}>{tierBadge.label}</Badge>}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-[#8B95A5]">
          <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{post.views || 0}</span>
          <span className="flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" />{post.likes}</span>
          <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{post.comment_count || 0}</span>
        </div>
      </div>
    </Card>
  );
}

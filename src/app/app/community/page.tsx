"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [eulaAgreed, setEulaAgreed] = useState<boolean | null>(null);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from("community_messages")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setPosts(data as Post[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // EULA 동의 여부 + 차단 목록 확인
    async function checkEulaAndBlocks() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("community_eula_agreed_at")
        .eq("id", user.id)
        .single();
      setEulaAgreed(!!profile?.community_eula_agreed_at);

      const { data: blocks } = await supabase
        .from("community_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      if (blocks) setBlockedIds(blocks.map((b: { blocked_id: string }) => b.blocked_id));
    }
    checkEulaAndBlocks();
    fetchPosts();

    const channel = supabase
      .channel("community-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages" }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchPosts]);

  const handleAgreeEula = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ community_eula_agreed_at: new Date().toISOString() })
      .eq("id", user.id);
    setEulaAgreed(true);
  };

  const filtered = (selectedTab === "all"
    ? posts
    : posts.filter((p) => p.message_type === selectedTab)
  ).filter((p) => !blockedIds.includes(p.user_id));

  const pinnedPosts = filtered.filter((p) => p.is_pinned);
  const regularPosts = filtered.filter((p) => !p.is_pinned);

  // EULA 미동의 시 동의 화면
  if (eulaAgreed === false) {
    return (
      <div className="py-4 space-y-4">
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-5">
          <h2 className="text-lg font-bold text-white mb-3">커뮤니티 이용약관</h2>
          <div className="text-xs text-[#8B95A5] space-y-2 mb-4 max-h-60 overflow-y-auto">
            <p>머니시그널 커뮤니티는 건전한 투자 정보 교류를 위한 공간입니다. 아래 규칙에 동의해야 커뮤니티를 이용할 수 있습니다.</p>
            <p className="font-semibold text-white">금지 행위:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>욕설, 비방, 혐오 발언 등 부적절한 콘텐츠 게시</li>
              <li>다른 사용자에 대한 괴롭힘, 협박, 스토킹</li>
              <li>허위 투자 정보, 사기성 콘텐츠 유포</li>
              <li>스팸, 광고, 홍보 목적의 반복 게시</li>
              <li>개인정보 무단 수집 및 유포</li>
              <li>저작권 침해 콘텐츠 게시</li>
            </ul>
            <p className="font-semibold text-white">운영 정책:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>부적절한 콘텐츠는 신고 접수 후 24시간 내 검토 및 조치됩니다.</li>
              <li>규칙 위반 시 게시글 삭제 및 계정 이용 제한 조치가 취해집니다.</li>
              <li>신고 및 차단 기능을 통해 불쾌한 콘텐츠와 사용자를 관리할 수 있습니다.</li>
            </ul>
            <p>자세한 내용은 <a href="/terms" className="text-[#F5B800] underline">이용약관</a>을 참고하세요.</p>
          </div>
          <Button
            onClick={handleAgreeEula}
            className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
          >
            동의하고 커뮤니티 시작하기
          </Button>
        </Card>
      </div>
    );
  }

  if (eulaAgreed === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
      </div>
    );
  }

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

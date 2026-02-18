"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  ThumbsUp,
  Eye,
  Crown,
  Send,
  Loader2,
  TrendingUp,
  TrendingDown,
  Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

interface Post {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  subscription_tier: string;
  title: string;
  message: string;
  message_type: string;
  signal_data: { symbol?: string; direction?: string } | null;
  likes: number;
  comment_count: number;
  views: number;
  is_pinned: boolean;
  created_at: string;
}

interface Comment {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  subscription_tier: string;
  message: string;
  likes: number;
  created_at: string;
}

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  free: { label: "", color: "" },
  basic: { label: "Basic", color: "bg-[#448AFF]/10 text-[#448AFF]" },
  pro: { label: "Pro", color: "bg-[#F5B800]/10 text-[#F5B800]" },
  premium: { label: "Premium", color: "bg-[#E040FB]/10 text-[#E040FB]" },
  bundle: { label: "VIP", color: "bg-[#00E676]/10 text-[#00E676]" },
};

const AVATAR_COLORS = ["bg-[#F5B800]", "bg-[#00E676]", "bg-[#448AFF]", "bg-[#E040FB]", "bg-[#FF5252]", "bg-[#00BCD4]"];

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{
    id: string; display_name: string; role: string; subscription_tier: string;
  } | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, role, subscription_tier")
          .eq("id", user.id)
          .single();
        if (profile) setUserProfile(profile);
      }

      // Fetch post
      const { data: postData } = await supabase
        .from("community_messages")
        .select("*")
        .eq("id", params.id)
        .single();

      if (postData) {
        setPost(postData as Post);

        // Increment views
        await supabase
          .from("community_messages")
          .update({ views: (postData.views || 0) + 1 })
          .eq("id", params.id);
      }

      // Fetch comments
      const { data: commentData } = await supabase
        .from("community_comments")
        .select("*")
        .eq("post_id", params.id)
        .order("created_at", { ascending: true });

      if (commentData) setComments(commentData as Comment[]);
      setLoading(false);
    }

    fetchData();

    // Realtime comments
    const channel = supabase
      .channel(`post-${params.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "community_comments",
        filter: `post_id=eq.${params.id}`,
      }, (payload) => {
        setComments((prev) => [...prev, payload.new as Comment]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id, supabase]);

  const handleLike = async () => {
    if (!post || liked) return;
    await supabase
      .from("community_messages")
      .update({ likes: post.likes + 1 })
      .eq("id", post.id);
    setPost({ ...post, likes: post.likes + 1 });
    setLiked(true);
  };

  const handleComment = async () => {
    if (!newComment.trim() || !userProfile || !post) return;
    setSending(true);
    try {
      const { error } = await supabase.from("community_comments").insert({
        post_id: post.id,
        user_id: userProfile.id,
        display_name: userProfile.display_name || "익명",
        role: userProfile.role,
        subscription_tier: userProfile.subscription_tier,
        message: newComment.trim(),
        likes: 0,
      });

      if (error) throw error;

      // Update comment count
      await supabase
        .from("community_messages")
        .update({ comment_count: (post.comment_count || 0) + 1 })
        .eq("id", post.id);

      setPost({ ...post, comment_count: (post.comment_count || 0) + 1 });
      setNewComment("");
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      toast.error("댓글 등록에 실패했습니다");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-20">
        <p className="text-[#8B95A5]">게시글을 찾을 수 없습니다</p>
      </div>
    );
  }

  const isAdmin = post.role === "admin";
  const isPartner = post.role === "partner";
  const tierBadge = TIER_BADGES[post.subscription_tier];
  const avatarColor = AVATAR_COLORS[post.display_name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <div className="py-4 space-y-4">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[#8B95A5] -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> 목록
      </Button>

      {/* Post */}
      <Card className={cn("bg-[#1A1D26] border-[#2A2D36] p-4", post.is_pinned && "border-l-2 border-l-[#F5B800]")}>
        {/* Author */}
        <div className="flex items-center gap-2.5 mb-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className={cn("text-[10px] font-bold text-[#0D0F14]", isAdmin ? "bg-[#FF5252]" : isPartner ? "bg-[#F5B800]" : avatarColor)}>
              {isAdmin ? "👑" : (post.display_name || "?")[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-sm font-medium", isAdmin ? "text-[#FF5252]" : isPartner ? "text-[#F5B800]" : "text-white")}>
                {post.display_name}
              </span>
              {isAdmin && <Badge className="bg-[#FF5252]/10 text-[#FF5252] border-0 text-[7px] px-1 py-0"><Crown className="w-2 h-2 mr-0.5" />관리자</Badge>}
              {isPartner && <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-[7px] px-1 py-0">운영자</Badge>}
              {tierBadge.label && <Badge className={cn("border-0 text-[7px] px-1 py-0", tierBadge.color)}>{tierBadge.label}</Badge>}
            </div>
            <span className="text-[10px] text-[#8B95A5]">{dayjs(post.created_at).format("YYYY.MM.DD HH:mm")}</span>
          </div>
          {post.is_pinned && <Pin className="w-3.5 h-3.5 text-[#F5B800] ml-auto" />}
        </div>

        {/* Signal badge */}
        {post.signal_data?.symbol && (
          <div className="mb-3">
            <Badge className={cn(
              "border-0 text-xs",
              post.signal_data.direction === "long" || post.signal_data.direction === "buy"
                ? "bg-[#00E676]/10 text-[#00E676]"
                : "bg-[#FF5252]/10 text-[#FF5252]"
            )}>
              {post.signal_data.symbol}{" "}
              {post.signal_data.direction === "long" || post.signal_data.direction === "buy"
                ? <TrendingUp className="w-3 h-3 ml-1 inline" />
                : <TrendingDown className="w-3 h-3 ml-1 inline" />
              }
              {" "}{(post.signal_data.direction || "").toUpperCase()}
            </Badge>
          </div>
        )}

        {/* Title */}
        <h2 className="text-base font-bold text-white mb-3">{post.title}</h2>

        {/* Content */}
        <p className="text-sm text-[#8B95A5] leading-relaxed whitespace-pre-wrap">{post.message}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#2A2D36]">
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              liked ? "text-[#F5B800]" : "text-[#8B95A5] hover:text-[#F5B800]"
            )}
          >
            <ThumbsUp className={cn("w-4 h-4", liked && "fill-[#F5B800]")} />
            좋아요 {post.likes}
          </button>
          <span className="flex items-center gap-1 text-xs text-[#8B95A5]">
            <Eye className="w-4 h-4" /> 조회 {post.views}
          </span>
        </div>
      </Card>

      {/* Comments */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          댓글 {comments.length}
        </h3>

        <div className="space-y-2">
          {comments.map((comment) => {
            const cIsAdmin = comment.role === "admin";
            const cTier = TIER_BADGES[comment.subscription_tier];
            const cColor = AVATAR_COLORS[comment.display_name.charCodeAt(0) % AVATAR_COLORS.length];

            return (
              <Card key={comment.id} className="bg-[#1A1D26] border-[#2A2D36] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className={cn("text-[8px] font-bold text-[#0D0F14]", cIsAdmin ? "bg-[#FF5252]" : cColor)}>
                      {cIsAdmin ? "👑" : (comment.display_name || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn("text-xs font-medium", cIsAdmin ? "text-[#FF5252]" : "text-[#8B95A5]")}>
                    {comment.display_name}
                  </span>
                  {cTier.label && <Badge className={cn("border-0 text-[7px] px-1 py-0", cTier.color)}>{cTier.label}</Badge>}
                  <span className="text-[9px] text-[#8B95A5]/50 ml-auto">{dayjs(comment.created_at).fromNow()}</span>
                </div>
                <p className="text-sm text-[#E0E0E0] pl-8">{comment.message}</p>
              </Card>
            );
          })}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment input */}
        <div className="mt-3">
          <form
            onSubmit={(e) => { e.preventDefault(); handleComment(); }}
            className="flex gap-2"
          >
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              maxLength={500}
              className="bg-[#1A1D26] border-[#2A2D36] text-white flex-1"
            />
            <Button
              type="submit"
              disabled={!newComment.trim() || sending}
              className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] px-3 shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

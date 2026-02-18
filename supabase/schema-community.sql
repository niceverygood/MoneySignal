-- ============================================
-- 커뮤니티 게시판 스키마
-- ============================================

-- 게시글 테이블 (기존 community_messages 확장)
ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- message_type 확장 (discussion, signal_share, analysis, question)
-- 기존 check 제약이 있으면 삭제 후 재생성
ALTER TABLE public.community_messages DROP CONSTRAINT IF EXISTS community_messages_message_type_check;

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '익명',
  role TEXT NOT NULL DEFAULT 'user',
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  message TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.community_comments (post_id, created_at);

-- RLS
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read comments" ON public.community_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can post comments" ON public.community_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own or admin all" ON public.community_comments
  FOR UPDATE USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete comments" ON public.community_comments
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;

-- ============================================
-- 커뮤니티 채팅 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '익명',
  role TEXT NOT NULL DEFAULT 'user',
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'chat' CHECK (message_type IN ('chat', 'signal_share', 'system')),
  signal_data JSONB,
  likes INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_created ON public.community_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_pinned ON public.community_messages (is_pinned) WHERE is_pinned = TRUE;

-- RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated can read messages" ON public.community_messages
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can insert their own messages
CREATE POLICY "Users can send messages" ON public.community_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own (for edits), admins can update all (for pinning)
CREATE POLICY "Users update own or admin updates all" ON public.community_messages
  FOR UPDATE USING (
    auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin'
  );

-- Admins can delete any message
CREATE POLICY "Admins can delete messages" ON public.community_messages
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;

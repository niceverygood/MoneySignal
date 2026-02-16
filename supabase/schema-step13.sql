-- ============================================
-- Step 13: AI Ask History Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_ask_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  symbols_mentioned TEXT[],
  category TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_ask_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own history"
  ON public.ai_ask_history
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_ai_ask_user_date
  ON public.ai_ask_history (user_id, created_at DESC);

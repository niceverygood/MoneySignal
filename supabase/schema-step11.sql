-- ============================================
-- STEP 11: Signal Views (daily limit tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.signal_views (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_signal_views_user_date ON public.signal_views (user_id, viewed_at);

ALTER TABLE public.signal_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own views" ON public.signal_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own views" ON public.signal_views
  FOR SELECT USING (auth.uid() = user_id);

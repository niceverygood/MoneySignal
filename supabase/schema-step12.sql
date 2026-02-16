CREATE TABLE IF NOT EXISTS public.user_signal_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  entry_price_actual NUMERIC,
  exit_price_actual NUMERIC,
  actual_pnl_percent NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, signal_id)
);

ALTER TABLE public.user_signal_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follows" ON public.user_signal_follows FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_user_signal_follows_user ON public.user_signal_follows (user_id, followed_at DESC);

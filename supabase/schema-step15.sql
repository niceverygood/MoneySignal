-- ============================================
-- Step 15: Market Reports (Weekly/Daily AI Reports)
-- ============================================

CREATE TABLE IF NOT EXISTS public.market_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('weekly', 'daily_briefing', 'monthly')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  performance_data JSONB,
  min_tier_required TEXT DEFAULT 'pro',
  week_start DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reports" ON public.market_reports
  FOR SELECT USING (true);

CREATE POLICY "Service can manage reports" ON public.market_reports
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_market_reports_type_date ON public.market_reports (type, created_at DESC);

-- ============================================
-- 추가 테이블 (IF NOT EXISTS로 안전하게)
-- ============================================

-- 1. 카카오 연동 (이미 존재할 수 있음)
CREATE TABLE IF NOT EXISTS public.kakao_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  kakao_user_id TEXT NOT NULL,
  kakao_access_token TEXT NOT NULL,
  kakao_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  kakao_nickname TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notification_settings JSONB DEFAULT '{"new_signal": true, "tp_hit": true, "sl_hit": true}'::jsonb,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.kakao_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own kakao" ON public.kakao_connections FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_kakao_user ON public.kakao_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_kakao_active ON public.kakao_connections (is_active) WHERE is_active = true;

-- 2. 정산 기록
CREATE TABLE IF NOT EXISTS public.settlement_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  gross_revenue INTEGER NOT NULL,
  partner_share INTEGER NOT NULL,
  platform_share INTEGER NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  revenue_share_rate NUMERIC NOT NULL DEFAULT 0.80,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.settlement_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Partners read own settlements" ON public.settlement_records FOR SELECT USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin read all settlements" ON public.settlement_records FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_settlement_partner ON public.settlement_records (partner_id, period_start DESC);

-- 3. 시그널 조회 기록
CREATE TABLE IF NOT EXISTS public.signal_views (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, signal_id)
);
ALTER TABLE public.signal_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users insert own views" ON public.signal_views FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users read own views" ON public.signal_views FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_signal_views_user_date ON public.signal_views (user_id, viewed_at);

-- 4. 유저 시그널 팔로우
CREATE TABLE IF NOT EXISTS public.user_signal_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  entry_price_actual NUMERIC,
  exit_price_actual NUMERIC,
  actual_pnl_percent NUMERIC,
  notes TEXT,
  UNIQUE(user_id, signal_id)
);
ALTER TABLE public.user_signal_follows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own follows" ON public.user_signal_follows FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_signal_follows ON public.user_signal_follows (user_id, followed_at DESC);

-- 5. AI 질문 이력
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
DO $$ BEGIN
  CREATE POLICY "Users read own history" ON public.ai_ask_history FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_ai_ask_user_date ON public.ai_ask_history (user_id, created_at DESC);

-- 6. 마켓 리포트
CREATE TABLE IF NOT EXISTS public.market_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('weekly', 'daily_briefing', 'monthly')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  performance_data JSONB,
  min_tier_required TEXT NOT NULL DEFAULT 'pro',
  week_start DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read market reports" ON public.market_reports FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_market_reports_type_date ON public.market_reports (type, created_at DESC);

-- 7. partners referral_code
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_partners_referral ON public.partners (referral_code);

-- 8. notifications 컬럼 추가
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'app';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data JSONB;

-- 9. Telegram connections
CREATE TABLE IF NOT EXISTS public.telegram_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notification_settings JSONB DEFAULT '{"new_signal":true,"tp_hit":true,"sl_hit":true,"daily_summary":true}'::jsonb,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own telegram" ON public.telegram_connections FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_telegram_connections_user ON public.telegram_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_connections_chat_id ON public.telegram_connections (telegram_chat_id);

-- 10. Telegram link codes
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own codes" ON public.telegram_link_codes FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user ON public.telegram_link_codes (user_id, used, expires_at);

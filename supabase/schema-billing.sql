-- ============================================
-- billing_keys 테이블 (유저당 카드 1개)
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  billing_key TEXT NOT NULL,
  card_name TEXT,
  card_number_masked TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.billing_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own billing key"
  ON public.billing_keys FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- subscriptions 테이블 빌링 컬럼 추가
-- ============================================

-- product_id, partner_id NOT NULL 해제 (파트너 없는 직접 구독 지원)
ALTER TABLE public.subscriptions
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN partner_id DROP NOT NULL;

-- 빌링 관련 컬럼 추가
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS billing_key_id UUID REFERENCES public.billing_keys(id),
  ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_billing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_failed_at TIMESTAMPTZ;

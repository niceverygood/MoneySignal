-- ============================================
-- 내 종목 합의 변화 알림 루프 (Pillar 3)
--   · symbol_consensus_daily: 종목 단위 일일 AI 합의 스냅샷 (전 보유자 공유)
--   · notifications.type 에 'consensus_change' 추가
-- ============================================

-- 종목 단위 일일 합의 스냅샷
CREATE TABLE IF NOT EXISTS public.symbol_consensus_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  consensus TEXT NOT NULL,            -- buy | hold | sell
  consensus_summary TEXT,
  current_price NUMERIC,
  ai_opinions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (market, symbol, snapshot_date)
);

ALTER TABLE public.symbol_consensus_daily ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated read symbol consensus" ON public.symbol_consensus_daily
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_symbol_consensus_lookup
  ON public.symbol_consensus_daily(market, symbol, snapshot_date DESC);

-- notifications.type 에 'consensus_change' 추가 (기존 CHECK 교체)
DO $$
DECLARE cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type = ANY (ARRAY['signal','subscription','payout','system','consensus_change']));
END $$;

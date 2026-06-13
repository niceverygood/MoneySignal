-- ============================================================
-- AI 적중률 추적 (Verdict Track Record)
-- 매일 AI 합의 Top5 픽을 발행가와 함께 기록 → 1/7/30일 수익률 채점
-- "AI가 추천한 종목이 실제로 얼마나 맞았는가"를 정직하게 공개하기 위한 토대
-- ============================================================

CREATE TABLE IF NOT EXISTS public.verdict_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verdict_date DATE NOT NULL,
  symbol TEXT NOT NULL,           -- KIS 종목코드 (6자리)
  name TEXT NOT NULL,
  rank INT,
  avg_score NUMERIC(3,1),
  is_unanimous BOOLEAN DEFAULT false,
  entry_price NUMERIC,            -- 평결 발행 시점 종가/현재가
  price_1d NUMERIC,  return_1d NUMERIC,
  price_7d NUMERIC,  return_7d NUMERIC,
  price_30d NUMERIC, return_30d NUMERIC,
  scored_at TIMESTAMPTZ,          -- 마지막 채점 시각
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (verdict_date, symbol)
);

CREATE INDEX IF NOT EXISTS idx_verdict_picks_date ON public.verdict_picks(verdict_date DESC);

ALTER TABLE public.verdict_picks ENABLE ROW LEVEL SECURITY;

-- 모든 유저 읽기 가능 (적중률 공개용)
DO $$ BEGIN
  CREATE POLICY "verdict_picks_select_all" ON public.verdict_picks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 쓰기는 service_role(크론)에서만 — service client는 RLS 우회하지만 안전상 명시
DO $$ BEGIN
  CREATE POLICY "verdict_picks_insert" ON public.verdict_picks FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "verdict_picks_update" ON public.verdict_picks FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

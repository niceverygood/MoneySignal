-- ============================================================
-- 내 종목 AI 진단 (Portfolio Diagnosis)
-- 보유종목 등록 → 실시간 손익 + AI 3대장 진단
-- ============================================================

-- 1. 보유종목
CREATE TABLE IF NOT EXISTS public.portfolio_holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  market TEXT NOT NULL CHECK (market IN ('kr_stock', 'crypto')),
  symbol TEXT NOT NULL,              -- 국내주식: 종목코드(005930) / 코인: BTCUSDT
  name TEXT NOT NULL,                -- 표시명 (삼성전자 / 비트코인)
  avg_price NUMERIC NOT NULL CHECK (avg_price > 0),   -- 평단가 (KRW / USDT)
  quantity NUMERIC NOT NULL CHECK (quantity > 0),     -- 보유수량
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, market, symbol)
);
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own holdings" ON public.portfolio_holdings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user ON public.portfolio_holdings(user_id);

-- 2. AI 진단 이력 (일일 횟수 제한 + 재열람)
CREATE TABLE IF NOT EXISTS public.portfolio_diagnoses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  holding_id UUID REFERENCES public.portfolio_holdings(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  avg_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL,
  pnl_percent NUMERIC NOT NULL,
  consensus TEXT NOT NULL,           -- hold | buy_more | reduce | cut
  consensus_summary TEXT,            -- 한 줄 합의 요약
  ai_opinions JSONB NOT NULL,        -- [{characterId, verdict, comment}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.portfolio_diagnoses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own diagnoses" ON public.portfolio_diagnoses
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- insert는 service role에서만 수행
CREATE INDEX IF NOT EXISTS idx_portfolio_diagnoses_user_created
  ON public.portfolio_diagnoses(user_id, created_at DESC);

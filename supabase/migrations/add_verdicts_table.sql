-- ============================================
-- AI 합의 판정 (Verdicts) 테이블
-- 3개 AI의 일일 Top 5 합의 결과 저장
-- ============================================

CREATE TABLE IF NOT EXISTS public.verdicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  top5 JSONB NOT NULL DEFAULT '[]',           -- 합의 Top 5
  claude_top5 JSONB DEFAULT '[]',             -- Claude 개별 Top 5
  gemini_top5 JSONB DEFAULT '[]',             -- Gemini 개별 Top 5
  gpt_top5 JSONB DEFAULT '[]',               -- GPT 개별 Top 5
  theme_name TEXT,                            -- 요일별 테마 이름
  theme_emoji TEXT,                           -- 테마 이모지
  sentiment_score INTEGER,                    -- 공포-탐욕 지수 (0-100)
  sentiment_label TEXT,                       -- 레벨 라벨 (공포/중립/탐욕 등)
  buy_weight NUMERIC(3,2),                    -- 매수 가중치 (0.0~1.0)
  consensus_summary TEXT,                     -- 합의 요약 한줄
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 날짜 인덱스 (조회 최적화)
CREATE INDEX IF NOT EXISTS idx_verdicts_date ON public.verdicts(date DESC);

-- 날짜 유니크 (하루에 하나만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_verdicts_date_unique ON public.verdicts(date);

-- RLS
ALTER TABLE public.verdicts ENABLE ROW LEVEL SECURITY;

-- 모든 인증 유저 읽기 가능
CREATE POLICY "verdicts_select_all" ON public.verdicts
  FOR SELECT USING (true);

-- service_role만 삽입/수정 가능
CREATE POLICY "verdicts_insert_service" ON public.verdicts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "verdicts_update_service" ON public.verdicts
  FOR UPDATE USING (true);

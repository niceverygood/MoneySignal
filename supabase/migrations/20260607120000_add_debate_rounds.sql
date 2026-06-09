-- verdicts 테이블에 멀티턴 토론 과정 저장 컬럼 추가
-- 라운드1(독립 분석) → 라운드2(상호 토론) → 라운드3(최종 합의)의 각 AI 코멘트를 JSONB로 보관
ALTER TABLE public.verdicts
  ADD COLUMN IF NOT EXISTS debate_rounds JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- 운영자 추천코드 시스템 추가
-- ============================================

-- partners 테이블에 referral_code 추가
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- referral_code 인덱스
CREATE INDEX IF NOT EXISTS idx_partners_referral ON public.partners (referral_code) WHERE referral_code IS NOT NULL;

-- 기존 파트너에 코드가 없으면 자동 생성 (선택)
-- UPDATE public.partners SET referral_code = upper(substr(md5(random()::text), 1, 6)) WHERE referral_code IS NULL;

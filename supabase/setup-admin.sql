-- ============================================
-- 관리자 계정 설정 (Supabase SQL Editor에서 실행)
-- ============================================

-- 1. hss@bottlecorp.kr 유저를 admin으로 설정
UPDATE public.profiles
SET role = 'admin', display_name = '총괄관리자'
WHERE email = 'hss@bottlecorp.kr';

-- 2. 이메일 인증 강제 완료 (auth.users 테이블)
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'hss@bottlecorp.kr'
  AND email_confirmed_at IS NULL;

-- 확인
SELECT id, email, role, display_name FROM public.profiles WHERE email = 'hss@bottlecorp.kr';

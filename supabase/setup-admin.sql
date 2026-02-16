-- ============================================
-- 총괄 관리자 계정 설정
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 비밀번호를 Bottle123!로 변경
UPDATE auth.users 
SET encrypted_password = crypt('Bottle123!', gen_salt('bf'))
WHERE email = 'hss@bottlecorp.kr';

-- 2. 이메일 인증 강제 완료
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'hss@bottlecorp.kr'
  AND email_confirmed_at IS NULL;

-- 3. profiles 테이블에 admin 역할 부여
UPDATE public.profiles
SET role = 'admin', display_name = '총괄관리자'
WHERE email = 'hss@bottlecorp.kr';

-- 4. 확인 쿼리
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  p.role,
  p.display_name
FROM auth.users u 
JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'hss@bottlecorp.kr';

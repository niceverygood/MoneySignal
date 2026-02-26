-- 닉네임/이메일 중복검사 RPC 함수
-- SECURITY DEFINER로 RLS 우회, boolean만 반환 (데이터 노출 없음)

CREATE OR REPLACE FUNCTION public.check_nickname_available(p_nickname text)
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE display_name = p_nickname
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_email_available(p_email text)
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE email = lower(p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

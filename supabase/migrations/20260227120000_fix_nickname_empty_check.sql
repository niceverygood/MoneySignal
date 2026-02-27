-- 닉네임 RPC: 빈 문자열 / 1자 입력 시 false 반환 (최소 2자)
-- 이메일 RPC: 빈 문자열 / 형식 불일치 시 false 반환

CREATE OR REPLACE FUNCTION public.check_nickname_available(p_nickname text)
RETURNS boolean AS $$
BEGIN
  IF p_nickname IS NULL OR length(trim(p_nickname)) < 2 THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE display_name = trim(p_nickname)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_email_available(p_email text)
RETURNS boolean AS $$
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) < 5 OR position('@' IN p_email) = 0 THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE email = lower(trim(p_email))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

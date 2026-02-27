-- ============================================
-- Profiles RLS 정책 강화
-- 1. 관리자 UPDATE 권한 추가
-- 2. INSERT 정책: trigger 자동생성만 허용
-- 3. DELETE 정책: 관리자 전용
-- ============================================

-- 관리자 UPDATE 정책 추가
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT 정책: service_role 또는 trigger만 가능 (일반 유저 INSERT 금지)
-- handle_new_user trigger는 SECURITY DEFINER이므로 RLS 무시됨
CREATE POLICY "No direct profile insert" ON public.profiles
  FOR INSERT WITH CHECK (false);

-- DELETE 정책: 관리자 전용 (일반 유저 삭제 불가, CASCADE는 RLS 무시됨)
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

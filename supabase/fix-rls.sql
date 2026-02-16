-- ============================================
-- RLS 무한 재귀 수정
-- profiles 테이블의 admin 정책이 profiles를 다시 조회하면서 무한루프 발생
-- 해결: security definer 함수로 역할 체크
-- ============================================

-- 1. 역할 체크 함수 (security definer → RLS를 우회)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = user_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. profiles 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 본인 프로필 읽기
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 본인 프로필 수정
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin은 전체 프로필 읽기 (함수로 체크하여 재귀 방지)
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- 3. partners 정책도 같은 문제 수정
DROP POLICY IF EXISTS "Admins can manage partners" ON public.partners;
CREATE POLICY "Admins can manage partners" ON public.partners
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- 4. subscriptions
DROP POLICY IF EXISTS "Admins can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- 5. signals
DROP POLICY IF EXISTS "Admins can manage signals" ON public.signals;
CREATE POLICY "Admins can manage signals" ON public.signals
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- 6. transactions
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.transactions;
CREATE POLICY "Admins can manage transactions" ON public.transactions
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- 7. withdrawal_requests
DROP POLICY IF EXISTS "Admins can manage withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admins can manage withdrawals" ON public.withdrawal_requests
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- 8. products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- 9. backtest_results
DROP POLICY IF EXISTS "Admins can manage backtest" ON public.backtest_results;
CREATE POLICY "Admins can manage backtest" ON public.backtest_results
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

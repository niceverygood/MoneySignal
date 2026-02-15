-- ============================================
-- MoneySignal - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (유저 프로필)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'partner', 'admin')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium', 'bundle')),
  subscription_expires_at TIMESTAMPTZ,
  referred_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. PARTNERS (파트너 = 리딩방 운영자)
-- ============================================
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_slug TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'pro', 'elite', 'legend')),
  revenue_share_rate NUMERIC NOT NULL DEFAULT 0.80,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  bio TEXT,
  profile_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. PRODUCTS (파트너가 만든 구독 상품)
-- ============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('coin_spot', 'coin_futures', 'overseas_futures', 'kr_stock', 'bundle')),
  price_monthly INTEGER NOT NULL,
  price_quarterly INTEGER,
  price_yearly INTEGER,
  description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_signals_per_day INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(partner_id, slug)
);

-- ============================================
-- 4. SUBSCRIPTIONS (유저 구독)
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  amount_paid INTEGER NOT NULL,
  partner_share INTEGER NOT NULL,
  platform_share INTEGER NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. SIGNALS (AI 시그널)
-- ============================================
CREATE TABLE IF NOT EXISTS public.signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('coin_spot', 'coin_futures', 'overseas_futures', 'kr_stock')),
  symbol TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'buy', 'sell')),
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit_1 NUMERIC,
  take_profit_2 NUMERIC,
  take_profit_3 NUMERIC,
  leverage_conservative INTEGER,
  leverage_aggressive INTEGER,
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  timeframe TEXT NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  ai_reasoning TEXT NOT NULL,
  ai_models_used TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hit_tp1', 'hit_tp2', 'hit_tp3', 'hit_sl', 'expired', 'cancelled')),
  result_pnl_percent NUMERIC,
  closed_at TIMESTAMPTZ,
  min_tier_required TEXT NOT NULL DEFAULT 'basic' CHECK (min_tier_required IN ('basic', 'pro', 'premium', 'bundle')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. SIGNAL_TRACKING (시그널 가격 추적 로그)
-- ============================================
CREATE TABLE IF NOT EXISTS public.signal_tracking (
  id BIGSERIAL PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  current_price NUMERIC NOT NULL,
  pnl_percent NUMERIC NOT NULL,
  status_at_check TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 7. BACKTEST_RESULTS (백테스트 결과)
-- ============================================
CREATE TABLE IF NOT EXISTS public.backtest_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_signals INTEGER NOT NULL DEFAULT 0,
  winning_signals INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  avg_profit_percent NUMERIC NOT NULL DEFAULT 0,
  avg_loss_percent NUMERIC NOT NULL DEFAULT 0,
  max_drawdown_percent NUMERIC NOT NULL DEFAULT 0,
  sharpe_ratio NUMERIC,
  profit_factor NUMERIC NOT NULL DEFAULT 0,
  total_pnl_percent NUMERIC NOT NULL DEFAULT 0,
  monthly_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category, period_start, period_end)
);

-- ============================================
-- 8. TRANSACTIONS (결제/정산 내역)
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('subscription_payment', 'partner_payout', 'refund')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  payment_method TEXT,
  pg_transaction_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 9. WITHDRAWAL_REQUESTS (파트너 출금 요청)
-- ============================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  processed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 10. NOTIFICATIONS (알림)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('signal', 'subscription', 'payout', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- signals: category + created_at
CREATE INDEX IF NOT EXISTS idx_signals_category_created ON public.signals(category, created_at DESC);

-- signals: status
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);

-- signals: min_tier_required
CREATE INDEX IF NOT EXISTS idx_signals_tier ON public.signals(min_tier_required);

-- subscriptions: user_id + status
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);

-- subscriptions: partner_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_partner ON public.subscriptions(partner_id);

-- backtest_results: category + period_end
CREATE INDEX IF NOT EXISTS idx_backtest_category_period ON public.backtest_results(category, period_end DESC);

-- signal_tracking: signal_id + checked_at
CREATE INDEX IF NOT EXISTS idx_signal_tracking_signal ON public.signal_tracking(signal_id, checked_at DESC);

-- notifications: user_id + is_read + created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

-- transactions: user_id + created_at
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id, created_at DESC);

-- transactions: partner_id + created_at
CREATE INDEX IF NOT EXISTS idx_transactions_partner ON public.transactions(partner_id, created_at DESC);

-- partners: brand_slug
CREATE INDEX IF NOT EXISTS idx_partners_slug ON public.partners(brand_slug);

-- products: partner_id + is_active
CREATE INDEX IF NOT EXISTS idx_products_partner ON public.products(partner_id, is_active);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- PARTNERS
-- Anyone can read active partners (public profiles)
CREATE POLICY "Anyone can view active partners" ON public.partners
  FOR SELECT USING (is_active = true);

-- Partners can view themselves even if inactive
CREATE POLICY "Partners can view own profile" ON public.partners
  FOR SELECT USING (user_id = auth.uid());

-- Partners can update their own data
CREATE POLICY "Partners can update own data" ON public.partners
  FOR UPDATE USING (user_id = auth.uid());

-- Partners can insert their own data
CREATE POLICY "Partners can insert own data" ON public.partners
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can manage all partners
CREATE POLICY "Admins can manage partners" ON public.partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- PRODUCTS
-- Anyone can view active products
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

-- Partners can manage their own products
CREATE POLICY "Partners can manage own products" ON public.products
  FOR ALL USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

-- Admins can manage all products
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- SUBSCRIPTIONS
-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Partners can view subscriptions to their products
CREATE POLICY "Partners can view their subscriptions" ON public.subscriptions
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can manage subscriptions (for API routes)
CREATE POLICY "Service can manage subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- SIGNALS
-- Anyone authenticated can view signals (tier check done in app)
CREATE POLICY "Authenticated users can view signals" ON public.signals
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage signals
CREATE POLICY "Service can manage signals" ON public.signals
  FOR ALL USING (auth.role() = 'service_role');

-- Admins can manage signals
CREATE POLICY "Admins can manage signals" ON public.signals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- SIGNAL_TRACKING
-- Authenticated can view
CREATE POLICY "Authenticated can view tracking" ON public.signal_tracking
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage
CREATE POLICY "Service can manage tracking" ON public.signal_tracking
  FOR ALL USING (auth.role() = 'service_role');

-- BACKTEST_RESULTS
-- Anyone can view (public data for trust building)
CREATE POLICY "Anyone can view backtest" ON public.backtest_results
  FOR SELECT USING (true);

-- Service role can manage
CREATE POLICY "Service can manage backtest" ON public.backtest_results
  FOR ALL USING (auth.role() = 'service_role');

-- Admins can manage
CREATE POLICY "Admins can manage backtest" ON public.backtest_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- TRANSACTIONS
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (user_id = auth.uid());

-- Partners can view their transactions
CREATE POLICY "Partners can view own transactions" ON public.transactions
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

-- Admins can manage all transactions
CREATE POLICY "Admins can manage transactions" ON public.transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can manage
CREATE POLICY "Service can manage transactions" ON public.transactions
  FOR ALL USING (auth.role() = 'service_role');

-- WITHDRAWAL_REQUESTS
-- Partners can view and create their own
CREATE POLICY "Partners can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

CREATE POLICY "Partners can create withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

-- Admins can manage all
CREATE POLICY "Admins can manage withdrawals" ON public.withdrawal_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- NOTIFICATIONS
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can manage
CREATE POLICY "Service can manage notifications" ON public.notifications
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- FUNCTION: Check subscription access
-- ============================================
CREATE OR REPLACE FUNCTION public.check_tier_access(
  user_tier TEXT,
  required_tier TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  tier_order TEXT[] := ARRAY['free', 'basic', 'pro', 'premium', 'bundle'];
  user_idx INTEGER;
  required_idx INTEGER;
BEGIN
  user_idx := array_position(tier_order, user_tier);
  required_idx := array_position(tier_order, required_tier);
  
  IF user_idx IS NULL OR required_idx IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN user_idx >= required_idx;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Enable Realtime for signals and notifications
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================
-- Step 14: Telegram Bot Integration Tables
-- ============================================

-- Telegram connections: links a user to their Telegram chat
CREATE TABLE IF NOT EXISTS public.telegram_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notification_settings JSONB DEFAULT '{"new_signal":true,"tp_hit":true,"sl_hit":true,"daily_summary":true}'::jsonb,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own telegram"
  ON public.telegram_connections
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_connections_user
  ON public.telegram_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_connections_chat_id
  ON public.telegram_connections (telegram_chat_id);

-- Telegram link codes: temporary codes for connecting accounts
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own codes"
  ON public.telegram_link_codes
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user
  ON public.telegram_link_codes (user_id, used, expires_at);

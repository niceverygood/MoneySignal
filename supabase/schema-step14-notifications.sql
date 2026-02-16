-- ============================================
-- Step 14b: Notification Channel Columns
-- ============================================

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'app';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_notifications_channel
  ON public.notifications (channel, sent_at);

CREATE INDEX IF NOT EXISTS idx_notifications_telegram
  ON public.notifications (telegram_chat_id, sent_at)
  WHERE channel = 'telegram';

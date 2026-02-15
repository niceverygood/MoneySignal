// ============================================
// MoneySignal Type Definitions
// ============================================

export type UserRole = "user" | "partner" | "admin";
export type SubscriptionTier = "free" | "basic" | "pro" | "premium" | "bundle";
export type PartnerTier = "starter" | "pro" | "elite" | "legend";
export type SignalCategory = "coin_spot" | "coin_futures" | "overseas_futures" | "kr_stock";
export type SignalDirection = "long" | "short" | "buy" | "sell";
export type SignalStatus = "active" | "hit_tp1" | "hit_tp2" | "hit_tp3" | "hit_sl" | "expired" | "cancelled";
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "pending";
export type BillingCycle = "monthly" | "quarterly" | "yearly";
export type TransactionType = "subscription_payment" | "partner_payout" | "refund";
export type TransactionStatus = "pending" | "completed" | "failed" | "cancelled";
export type WithdrawalStatus = "pending" | "processing" | "completed" | "rejected";
export type NotificationType = "signal" | "subscription" | "payout" | "system";
export type ProductCategory = "coin_spot" | "coin_futures" | "overseas_futures" | "kr_stock" | "bundle";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  user_id: string;
  brand_name: string;
  brand_slug: string;
  tier: PartnerTier;
  revenue_share_rate: number;
  total_revenue: number;
  total_withdrawn: number;
  available_balance: number;
  subscriber_count: number;
  bio: string | null;
  profile_image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  partner_id: string;
  name: string;
  slug: string;
  category: ProductCategory;
  price_monthly: number;
  price_quarterly: number | null;
  price_yearly: number | null;
  description: string;
  features: string[];
  max_signals_per_day: number;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  product_id: string;
  partner_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  amount_paid: number;
  partner_share: number;
  platform_share: number;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  created_at: string;
}

export interface Signal {
  id: string;
  category: SignalCategory;
  symbol: string;
  symbol_name: string;
  direction: SignalDirection;
  entry_price: number;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  take_profit_3: number | null;
  leverage_conservative: number | null;
  leverage_aggressive: number | null;
  confidence: number;
  timeframe: string;
  valid_until: string;
  ai_reasoning: string;
  ai_models_used: string[];
  status: SignalStatus;
  result_pnl_percent: number | null;
  closed_at: string | null;
  min_tier_required: SubscriptionTier;
  created_at: string;
}

export interface SignalTracking {
  id: number;
  signal_id: string;
  current_price: number;
  pnl_percent: number;
  status_at_check: string;
  checked_at: string;
}

export interface BacktestResult {
  id: string;
  category: string;
  period_start: string;
  period_end: string;
  total_signals: number;
  winning_signals: number;
  win_rate: number;
  avg_profit_percent: number;
  avg_loss_percent: number;
  max_drawdown_percent: number;
  sharpe_ratio: number | null;
  profit_factor: number;
  total_pnl_percent: number;
  monthly_breakdown: MonthlyBreakdown[];
  generated_at: string;
}

export interface MonthlyBreakdown {
  month: string;
  signals: number;
  winRate: number;
  pnl: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  user_id: string | null;
  partner_id: string | null;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: TransactionStatus;
  payment_method: string | null;
  pg_transaction_id: string | null;
  description: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  partner_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: WithdrawalStatus;
  processed_at: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ============================================
// UI Helper Types
// ============================================

export interface SignalWithPrice extends Signal {
  current_price?: number;
  current_pnl_percent?: number;
  tp1_progress?: number;
}

export const CATEGORY_LABELS: Record<SignalCategory, string> = {
  coin_spot: "코인 현물",
  coin_futures: "코인 선물",
  overseas_futures: "해외선물",
  kr_stock: "국내주식",
};

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "무료",
  basic: "베이직",
  pro: "프로",
  premium: "프리미엄",
  bundle: "번들",
};

export const TIER_ACCESS: Record<SubscriptionTier, SignalCategory[]> = {
  free: [],
  basic: ["coin_spot"],
  pro: ["coin_spot", "coin_futures"],
  premium: ["coin_spot", "coin_futures", "overseas_futures", "kr_stock"],
  bundle: ["coin_spot", "coin_futures", "overseas_futures", "kr_stock"],
};

export const PARTNER_TIER_RATES: Record<PartnerTier, number> = {
  starter: 0.8,
  pro: 0.83,
  elite: 0.85,
  legend: 0.88,
};

export const PARTNER_TIER_THRESHOLDS: Record<PartnerTier, number> = {
  starter: 0,
  pro: 51,
  elite: 201,
  legend: 501,
};

// ============================================
// PortOne 결제 유틸리티
// ============================================

export const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "";
export const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "";

export interface PaymentRequest {
  orderName: string;
  totalAmount: number;
  tier: string;
  billingCycle: string;
  referralCode?: string;
}

export function generateOrderId(): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MS-${dateStr}-${random}`;
}

export function getTierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    basic: "Basic 구독",
    pro: "Pro 구독",
    premium: "Premium 구독",
    bundle: "VIP Bundle 구독",
  };
  return names[tier] || `${tier} 구독`;
}

export function getCycleLabel(cycle: string): string {
  const labels: Record<string, string> = {
    monthly: "월간",
    quarterly: "분기",
    yearly: "연간",
  };
  return labels[cycle] || cycle;
}

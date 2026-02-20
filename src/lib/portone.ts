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

// ============================================
// 구독 플랜 가격표
// ============================================
export const PLAN_PRICES: Record<string, Record<string, number>> = {
  basic: { monthly: 29900, quarterly: 79900, yearly: 299000 },
  pro: { monthly: 59900, quarterly: 159900, yearly: 599000 },
  premium: { monthly: 99900, quarterly: 269900, yearly: 999000 },
  bundle: { monthly: 149900, quarterly: 399900, yearly: 1499000 },
};

// ============================================
// 빌링키 결제 (PortOne V2 API)
// ============================================
export async function chargeBillingKey(params: {
  billingKey: string;
  paymentId: string;
  orderName: string;
  amount: number;
  currency?: string;
}): Promise<{
  success: boolean;
  pgTransactionId?: string;
  failureReason?: string;
}> {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    // 개발 환경 fallback
    if (process.env.NODE_ENV !== "production") {
      return { success: true, pgTransactionId: `dev-${params.paymentId}` };
    }
    return { success: false, failureReason: "PORTONE_API_SECRET not configured" };
  }

  try {
    const res = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(params.paymentId)}/billing-key`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${apiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billingKey: params.billingKey,
          orderName: params.orderName,
          amount: {
            total: params.amount,
          },
          currency: params.currency || "KRW",
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        pgTransactionId: data.pgTxId || params.paymentId,
      };
    }

    const errData = await res.json().catch(() => ({}));
    console.error("[chargeBillingKey] PortOne error:", res.status, errData);
    return {
      success: false,
      failureReason: errData.message || `PortOne API error: ${res.status}`,
    };
  } catch (err) {
    console.error("[chargeBillingKey] Network error:", err);
    return {
      success: false,
      failureReason: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ============================================
// 구독 기간 계산 유틸
// ============================================
export function calculatePeriodEnd(billingCycle: string, from?: Date): Date {
  const periodEnd = new Date(from || new Date());
  switch (billingCycle) {
    case "quarterly":
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      break;
    case "yearly":
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  return periodEnd;
}

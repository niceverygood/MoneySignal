import { registerPlugin } from "@capacitor/core";

// ============================================
// StoreKit Capacitor Plugin Interface
// ============================================

export interface StoreKitProduct {
  id: string;
  displayName: string;
  description: string;
  price: number;
  displayPrice: string;
  type: string;
  subscriptionPeriod?: string;
}

export interface StoreKitTransaction {
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDate: string;
  expirationDate: string;
}

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  pending?: boolean;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  purchaseDate?: string;
  expirationDate?: string;
  jwsRepresentation?: string;
}

interface StoreKitPluginInterface {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreKitProduct[] }>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  restorePurchases(): Promise<{ transactions: StoreKitTransaction[] }>;
  getCurrentEntitlements(): Promise<{ entitlements: (StoreKitTransaction & { isExpired: boolean })[] }>;
  addListener(event: string, callback: (data: unknown) => void): Promise<{ remove: () => void }>;
}

const StoreKit = registerPlugin<StoreKitPluginInterface>("StoreKit");

export default StoreKit;

// ============================================
// IAP Product ID 매핑
// ============================================

const APP_BUNDLE_ID = "app.moneysignal.kr";

// App Store Connect에 등록된 실제 제품 ID (변경 불가)
export const IAP_PRODUCT_IDS: Record<string, Record<string, string>> = {
  basic: {
    monthly: "app.moneysinal.kr.basic.monthly", // App Store Connect 오타 (moneysinal)
    quarterly: `${APP_BUNDLE_ID}.basic.quarterly`,
    yearly: `${APP_BUNDLE_ID}.basic.annual`,
  },
  pro: {
    monthly: `${APP_BUNDLE_ID}.pro.monthly`,
    quarterly: `${APP_BUNDLE_ID}.pro.quarterly`,
    yearly: `${APP_BUNDLE_ID}.pro.annual`,
  },
  premium: {
    monthly: `${APP_BUNDLE_ID}.premium.monthly`,
    quarterly: `${APP_BUNDLE_ID}.premium.Quarterly`, // App Store Connect 대문자 Q
  },
  bundle: {
    monthly: `${APP_BUNDLE_ID}.bundle.monthly`,
    quarterly: `${APP_BUNDLE_ID}.bundle.quarterly`,
  },
};

/** 모든 IAP 상품 ID 목록 */
export function getAllProductIds(): string[] {
  const ids: string[] = [];
  for (const tier of Object.values(IAP_PRODUCT_IDS)) {
    for (const id of Object.values(tier)) {
      ids.push(id);
    }
  }
  return ids;
}

/** productId에서 tier와 billingCycle 추출 */
export function parseTierFromProductId(productId: string): { tier: string; billingCycle: string } | null {
  for (const [tier, cycles] of Object.entries(IAP_PRODUCT_IDS)) {
    for (const [cycle, id] of Object.entries(cycles)) {
      if (id === productId) return { tier, billingCycle: cycle };
    }
  }
  return null;
}

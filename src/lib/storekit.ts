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

export const IAP_PRODUCT_IDS: Record<string, Record<string, string>> = {
  basic: {
    monthly: `${APP_BUNDLE_ID}.basic.monthly`,
    quarterly: `${APP_BUNDLE_ID}.basic.quarterly`,
    yearly: `${APP_BUNDLE_ID}.basic.yearly`,
  },
  pro: {
    monthly: `${APP_BUNDLE_ID}.pro.monthly`,
    quarterly: `${APP_BUNDLE_ID}.pro.quarterly`,
    yearly: `${APP_BUNDLE_ID}.pro.yearly`,
  },
  premium: {
    monthly: `${APP_BUNDLE_ID}.premium.monthly`,
    quarterly: `${APP_BUNDLE_ID}.premium.quarterly`,
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

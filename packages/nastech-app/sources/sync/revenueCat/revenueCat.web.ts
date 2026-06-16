/**
 * revenueCat.web.ts — Web stub (no in-app purchases).
 */
import type {
  RevenueCatInterface,
  CustomerInfo,
  Product,
  Offerings,
  PurchaseResult,
  RevenueCatConfig,
  PaywallOptions,
} from "./types";
import { LogLevel, PaywallResult } from "./types";

const emptyCustomerInfo: CustomerInfo = {
  entitlements: { all: {} },
  activeSubscriptions: {},
  originalAppUserId: "",
  requestDate: new Date(),
};

class RevenueCatWebStub implements RevenueCatInterface {
  configure(_config: RevenueCatConfig): void {}
  setLogLevel(_level: LogLevel): void {}
  async getCustomerInfo(): Promise<CustomerInfo> {
    return emptyCustomerInfo;
  }
  async getOfferings(): Promise<Offerings> {
    return { current: null, all: {} };
  }
  async getProducts(_ids: string[]): Promise<Product[]> {
    return [];
  }
  async purchaseStoreProduct(_product: Product): Promise<PurchaseResult> {
    return { customerInfo: emptyCustomerInfo };
  }
  async syncPurchases(): Promise<void> {}
  async presentPaywall(_options?: PaywallOptions): Promise<PaywallResult> {
    return PaywallResult.NOT_PRESENTED;
  }
  async presentPaywallIfNeeded(
    _options?: PaywallOptions & { requiredEntitlementIdentifier: string },
  ): Promise<PaywallResult> {
    return PaywallResult.NOT_PRESENTED;
  }
}

export default new RevenueCatWebStub();

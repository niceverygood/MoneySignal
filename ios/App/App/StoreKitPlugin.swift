import Foundation
import Capacitor
import StoreKit

@available(iOS 15.0, *)
@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKit"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentEntitlements", returnType: CAPPluginReturnPromise),
    ]

    private var transactionListener: Task<Void, Error>?

    override public func load() {
        transactionListener = listenForTransactions()
    }

    deinit {
        transactionListener?.cancel()
    }

    // MARK: - Transaction Listener

    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result else { continue }
                await transaction.finish()
                self.notifyListeners("transactionUpdate", data: [
                    "productId": transaction.productID,
                    "transactionId": String(transaction.id),
                    "originalTransactionId": String(transaction.originalID),
                ])
            }
        }
    }

    // MARK: - Get Products

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let productIds = call.getArray("productIds", String.self), !productIds.isEmpty else {
            call.reject("productIds is required")
            return
        }

        Task {
            do {
                let storeProducts = try await Product.products(for: Set(productIds))
                let products = storeProducts.map { product -> [String: Any] in
                    var dict: [String: Any] = [
                        "id": product.id,
                        "displayName": product.displayName,
                        "description": product.description,
                        "price": NSDecimalNumber(decimal: product.price).doubleValue,
                        "displayPrice": product.displayPrice,
                        "type": productTypeString(product.type),
                    ]
                    if let subscription = product.subscription {
                        dict["subscriptionPeriod"] = periodString(subscription.subscriptionPeriod)
                    }
                    return dict
                }
                let foundIds = Set(storeProducts.map { $0.id })
                let missingIds = productIds.filter { !foundIds.contains($0) }
                call.resolve([
                    "products": products,
                    "requestedCount": productIds.count,
                    "foundCount": storeProducts.count,
                    "missingIds": missingIds,
                ])
            } catch {
                let nsErr = error as NSError
                call.reject(
                    "Failed to fetch products: \(error.localizedDescription)",
                    "\(nsErr.domain):\(nsErr.code)",
                    error
                )
            }
        }
    }

    // MARK: - Purchase

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }

        Task {
            do {
                let storeProducts = try await Product.products(for: [productId])
                guard let product = storeProducts.first else {
                    call.reject("Product not found: \(productId)")
                    return
                }

                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        let jwsRepresentation = verification.jwsRepresentation
                        call.resolve([
                            "success": true,
                            "productId": transaction.productID,
                            "transactionId": String(transaction.id),
                            "originalTransactionId": String(transaction.originalID),
                            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                            "expirationDate": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } ?? "",
                            "jwsRepresentation": jwsRepresentation,
                        ])
                    case .unverified(_, let error):
                        call.reject("Transaction verification failed: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.resolve(["success": false, "cancelled": true])
                case .pending:
                    call.resolve(["success": false, "pending": true])
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Restore Purchases

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var transactions: [[String: Any]] = []
                for await result in Transaction.currentEntitlements {
                    guard case .verified(let transaction) = result else { continue }
                    transactions.append([
                        "productId": transaction.productID,
                        "transactionId": String(transaction.id),
                        "originalTransactionId": String(transaction.originalID),
                        "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                        "expirationDate": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } ?? "",
                    ])
                }
                call.resolve(["transactions": transactions])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Get Current Entitlements

    @objc func getCurrentEntitlements(_ call: CAPPluginCall) {
        Task {
            var entitlements: [[String: Any]] = []
            for await result in Transaction.currentEntitlements {
                guard case .verified(let transaction) = result else { continue }
                entitlements.append([
                    "productId": transaction.productID,
                    "transactionId": String(transaction.id),
                    "originalTransactionId": String(transaction.originalID),
                    "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                    "expirationDate": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } ?? "",
                    "isExpired": transaction.expirationDate.map { $0 < Date() } ?? false,
                ])
            }
            call.resolve(["entitlements": entitlements])
        }
    }

    // MARK: - Helpers

    private func productTypeString(_ type: Product.ProductType) -> String {
        switch type {
        case .autoRenewable: return "autoRenewable"
        case .consumable: return "consumable"
        case .nonConsumable: return "nonConsumable"
        case .nonRenewable: return "nonRenewable"
        default: return "unknown"
        }
    }

    private func periodString(_ period: Product.SubscriptionPeriod) -> String {
        switch period.unit {
        case .day: return "\(period.value)d"
        case .week: return "\(period.value)w"
        case .month: return "\(period.value)m"
        case .year: return "\(period.value)y"
        @unknown default: return "unknown"
        }
    }
}

import Foundation
import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleSignIn"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    ]

    private var currentCall: CAPPluginCall?
    private var controllerHolder: ASAuthorizationController?
    private var contextHolder: PresentationContext?

    @objc func authorize(_ call: CAPPluginCall) {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()

        var scopes: [ASAuthorization.Scope] = []
        if let s = call.getString("scopes") {
            if s.contains("name") { scopes.append(.fullName) }
            if s.contains("email") { scopes.append(.email) }
        }
        if !scopes.isEmpty {
            request.requestedScopes = scopes
        }
        if let nonce = call.getString("nonce") {
            request.nonce = nonce
        }
        if let state = call.getString("state") {
            request.state = state
        }

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self

        let context = PresentationContext(viewController: self.bridge?.viewController)
        controller.presentationContextProvider = context

        self.currentCall = call
        self.controllerHolder = controller
        self.contextHolder = context

        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    private func resolveAndClear(_ payload: [String: Any]) {
        let call = self.currentCall
        self.currentCall = nil
        self.controllerHolder = nil
        self.contextHolder = nil
        call?.resolve(payload)
    }

    private func rejectAndClear(_ message: String, _ code: String? = nil, _ error: Error? = nil) {
        let call = self.currentCall
        self.currentCall = nil
        self.controllerHolder = nil
        self.contextHolder = nil
        if let code = code {
            call?.reject(message, code, error)
        } else {
            call?.reject(message)
        }
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            rejectAndClear("Invalid credential type")
            return
        }

        let identityTokenStr = credential.identityToken.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let authorizationCodeStr = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""

        var response: [String: Any] = [
            "user": credential.user,
            "identityToken": identityTokenStr,
            "authorizationCode": authorizationCodeStr,
        ]
        if let email = credential.email { response["email"] = email }
        if let given = credential.fullName?.givenName { response["givenName"] = given }
        if let family = credential.fullName?.familyName { response["familyName"] = family }

        resolveAndClear(["response": response])
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithError error: Error) {
        let nsErr = error as NSError
        if let authErr = error as? ASAuthorizationError {
            let code: String
            switch authErr.code {
            case .canceled:
                rejectAndClear("User canceled", "USER_CANCELED", error)
                return
            case .failed: code = "FAILED"
            case .invalidResponse: code = "INVALID_RESPONSE"
            case .notHandled: code = "NOT_HANDLED"
            case .unknown: code = "UNKNOWN"
            default: code = "\(nsErr.domain):\(nsErr.code)"
            }
            rejectAndClear(error.localizedDescription, code, error)
            return
        }
        rejectAndClear(error.localizedDescription, "\(nsErr.domain):\(nsErr.code)", error)
    }
}

private class PresentationContext: NSObject, ASAuthorizationControllerPresentationContextProviding {
    weak var viewController: UIViewController?

    init(viewController: UIViewController?) {
        self.viewController = viewController
        super.init()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = viewController?.view.window {
            return window
        }
        if let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) {
            return window
        }
        return ASPresentationAnchor()
    }
}

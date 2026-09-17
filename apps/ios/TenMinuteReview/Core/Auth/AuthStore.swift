import Foundation
import Observation
import UIKit

enum AuthState {
    case loading
    case signedOut
    case signedIn
}

@MainActor
@Observable
final class AuthStore {
    private(set) var state: AuthState = .loading
    private(set) var user: PublicUser?

    var isSignedIn: Bool {
        if case .signedIn = state { return true }
        return false
    }

    private let api: APIClient
    private let keychain: Keychain
    private let defaults: UserDefaults

    init(api: APIClient, keychain: Keychain, defaults: UserDefaults = .standard) {
        self.api = api
        self.keychain = keychain
        self.defaults = defaults
    }

    // MARK: Lifecycle

    func restore() async {
        guard let token = keychain.read(account: Self.tokenAccount) else {
            state = .signedOut
            return
        }
        api.bearerToken = token
        user = storedUser()
        if let user {
            L10n.uiLanguage = user.uiLanguage
            state = .signedIn
            return
        }
        do {
            let response: UserResponse = try await api.get(Endpoints.me)
            user = response.user
            persist(user: response.user)
            L10n.uiLanguage = response.user.uiLanguage
            state = .signedIn
        } catch {
            // Keep the token; the next authenticated call retries /api/me
            // or bounces to sign-in through onUnauthorized.
            clearLocalSession()
        }
    }

    func signIn(email: String, password: String) async throws {
        struct TokenResponse: Decodable {
            let token: String
            let user: PublicUser
        }
        let deviceName = "\(UIDevice.current.name) (iOS \(UIDevice.current.systemVersion))"
        let response: TokenResponse = try await api.send("POST", Endpoints.authToken, json: [
            "email": email,
            "password": password,
            "deviceName": deviceName,
        ])
        keychain.write(response.token, account: Self.tokenAccount)
        persist(user: response.user)
        api.bearerToken = response.token
        user = response.user
        L10n.uiLanguage = response.user.uiLanguage
        state = .signedIn

        // The server derives quiz dates from the stored timezone; follow the
        // device so daily quizzes land on the learner's calendar day.
        let timezone = TimeZone.current.identifier
        if timezone != response.user.timezone {
            try? await api.sendVoid("PATCH", Endpoints.me, json: ["timezone": timezone])
        }
    }

    /// Creates the account (invite code and email verification run on the
    /// web flow) and signs straight in.
    func signUp(email: String, password: String, inviteCode: String) async throws {
        struct SignupBody: Encodable {
            let email: String
            let password: String
            let inviteCode: String
            let timezone: String
            let uiLanguage: String
        }
        _ = try await api.sendVoid("POST", Endpoints.signup, json: SignupBody(
            email: email,
            password: password,
            inviteCode: inviteCode,
            timezone: TimeZone.current.identifier,
            uiLanguage: L10n.uiLanguage
        ))
        try await signIn(email: email, password: password)
    }

    func updateProfile(username: String? = nil, uiLanguage: String? = nil) async throws {
        var body: [String: String] = [:]
        if let username { body["username"] = username }
        if let uiLanguage { body["uiLanguage"] = uiLanguage }
        let response: UserResponse = try await api.send("PATCH", Endpoints.me, json: body)
        user = response.user
        persist(user: response.user)
        if let uiLanguage {
            L10n.uiLanguage = uiLanguage
        }
    }

    func changePassword(current: String?, next: String) async throws {
        var body: [String: String] = ["newPassword": next]
        if let current {
            body["currentPassword"] = current
        }
        _ = try await api.sendVoid("POST", Endpoints.mePassword, json: body)
    }

    func deleteAccount() async {
        _ = try? await api.sendVoid("DELETE", Endpoints.me)
        if let userId = user?.id {
            draftsWipe?(userId)
        }
        clearLocalSession()
    }

    func signOut() async {
        try? await api.sendVoid("POST", Endpoints.authTokenRevoke)
        handleUnauthorized()
    }

    /// Local sign-out when the token was rejected (revoked elsewhere or
    /// expired server-side). Performs no network calls.
    func handleUnauthorized() {
        guard isSignedIn || user != nil || api.bearerToken != nil else { return }
        clearLocalSession()
    }

    // MARK: Internals

    private static let tokenAccount = "bearer"
    private static let userKey = "tmr.current-user"

    /// Set by AppEnvironment so account deletion can wipe local drafts.
    var draftsWipe: ((String) -> Void)?

    private func clearLocalSession() {
        keychain.delete(account: Self.tokenAccount)
        api.bearerToken = nil
        user = nil
        defaults.removeObject(forKey: Self.userKey)
        state = .signedOut
    }

    private func storedUser() -> PublicUser? {
        guard let data = defaults.data(forKey: Self.userKey) else { return nil }
        return try? JSONDecoder().decode(PublicUser.self, from: data)
    }

    private func persist(user: PublicUser) {
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: Self.userKey)
        }
    }
}

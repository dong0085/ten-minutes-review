import Foundation
import Observation

@MainActor
@Observable
final class AppEnvironment {
    let api: APIClient
    let auth: AuthStore
    let drafts: DraftStore
    let images: AuthenticatedImageLoader
    let theme = ThemeStore()

    init() {
        let base = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
            ?? "http://localhost:3000"
        let api = APIClient(baseURL: URL(string: base) ?? URL(string: "http://localhost:3000")!)
        let auth = AuthStore(api: api, keychain: Keychain(service: "app.tenminutereview.token"))
        self.api = api
        self.auth = auth
        self.drafts = DraftStore()
        self.images = AuthenticatedImageLoader(api: api)
        api.onUnauthorized = { [weak auth] in
            Task { @MainActor in
                auth?.handleUnauthorized()
            }
        }
        auth.draftsWipe = { [weak drafts] userId in
            drafts?.removeAll(userId: userId)
        }
    }
}

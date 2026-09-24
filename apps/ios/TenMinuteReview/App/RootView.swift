import SwiftUI

struct RootView: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        Group {
            switch environment.auth.state {
            case .loading:
                ProgressView()
            case .signedOut:
                SignInView()
            case .signedIn:
                MainTabView()
            }
        }
        .task {
            await environment.auth.restore()
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            ClassroomsView()
                .tabItem { Label(L10n.t("tabs.classrooms"), systemImage: "books.vertical") }
            AccountView()
                .tabItem { Label(L10n.t("tabs.account"), systemImage: "person.crop.circle") }
        }
    }
}

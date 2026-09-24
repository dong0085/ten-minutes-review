import SwiftUI

@main
struct TenMinuteReviewApp: App {
    @State private var environment = AppEnvironment()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .environment(environment.theme)
                .tint(environment.theme.palette.tint)
        }
    }
}

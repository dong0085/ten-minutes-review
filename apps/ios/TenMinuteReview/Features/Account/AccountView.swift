import SwiftUI

struct AccountView: View {
    @Environment(AppEnvironment.self) private var environment

    @State private var isSigningOut = false

    var body: some View {
        NavigationStack {
            Form {
                if let user = environment.auth.user {
                    Section("Profile") {
                        LabeledContent("Email", value: user.email)
                        LabeledContent("Name", value: user.username ?? "—")
                        LabeledContent("Interface language", value: user.uiLanguage.uppercased())
                        LabeledContent("Timezone", value: user.timezone)
                    }
                }
                Section {
                    Button("Sign Out", role: .destructive) {
                        signOut()
                    }
                    .disabled(isSigningOut)
                }
                Section("About") {
                    LabeledContent("API", value: environment.api.baseURL.absoluteString)
                    Link("Manage account on the web", destination: environment.api.baseURL.appending(path: "account"))
                }
            }
            .navigationTitle("Account")
        }
    }

    private func signOut() {
        isSigningOut = true
        Task {
            let userId = environment.auth.user?.id
            await environment.auth.signOut()
            if let userId {
                environment.drafts.removeAll(userId: userId)
            }
            isSigningOut = false
        }
    }
}

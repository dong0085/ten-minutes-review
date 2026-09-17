import SwiftUI

struct AccountView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme

    @State private var isSigningOut = false

    var body: some View {
        NavigationStack {
            Form {
                if let user = environment.auth.user {
                    Section {
                        LabeledContent("Email", value: user.email)
                        LabeledContent("Name", value: user.username ?? "—")
                        LabeledContent("Interface language", value: user.uiLanguage.uppercased())
                        LabeledContent("Timezone", value: user.timezone)
                    } header: {
                        Text("Profile").eyebrowStyle(theme.colors)
                    }
                }
                Section {
                    ForEach(Palette.allCases) { palette in
                        Button {
                            theme.select(palette)
                        } label: {
                            HStack {
                                Circle()
                                    .fill(palette.swatch)
                                    .frame(width: 18, height: 18)
                                    .overlay {
                                        Circle().strokeBorder(theme.colors.border, lineWidth: 1)
                                    }
                                Text(palette.label)
                                    .foregroundStyle(theme.colors.foreground)
                                Spacer()
                                if theme.palette == palette {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(theme.colors.primary)
                                }
                            }
                        }
                    }
                } header: {
                    Text("Theme").eyebrowStyle(theme.colors)
                } footer: {
                    Text("Palettes match the website; light and dark follow this device's appearance.")
                }
                Section {
                    Button("Sign Out", role: .destructive) {
                        signOut()
                    }
                    .disabled(isSigningOut)
                }
                Section {
                    LabeledContent("API", value: environment.api.baseURL.absoluteString)
                    Link("Manage account on the web", destination: environment.api.baseURL.appending(path: "account"))
                } header: {
                    Text("About").eyebrowStyle(theme.colors)
                }
            }
            .paperScreen()
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

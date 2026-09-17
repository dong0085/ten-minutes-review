import SwiftUI

struct AccountView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme

    @State private var isSigningOut = false
    @State private var preferences: EmailPreferences?
    @State private var referrals: ReferralsResponse?
    @State private var showsPasswordSheet = false
    @State private var showsDeleteConfirm = false
    @State private var exportURL: URL?

    var body: some View {
        NavigationStack {
            Form {
                if let user = environment.auth.user {
                    Section {
                        LabeledContent(L10n.t("account.email"), value: user.email)
                        Button(L10n.t("account.name")) { editUsername = user.username ?? "" ; showsUsernameSheet = true }
                            .foregroundStyle(theme.colors.foreground)
                        LabeledContent(L10n.t("account.timezone"), value: user.timezone)
                    } header: {
                        Text(L10n.t("account.profile")).eyebrowStyle(theme.colors)
                    }
                    Section {
                        Picker(L10n.t("account.interfaceLanguage"), selection: Binding(
                            get: { user.uiLanguage },
                            set: { changeLanguage($0) }
                        )) {
                            Text("English").tag("en")
                            Text("Français").tag("fr")
                        }
                    } header: {
                        Text(L10n.t("account.interfaceLanguage")).eyebrowStyle(theme.colors)
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
                        .accessibilityLabel(Text(palette.label))
                    }
                } header: {
                    Text(L10n.t("account.theme")).eyebrowStyle(theme.colors)
                } footer: {
                    Text(L10n.t("account.themeFooter"))
                }

                Section {
                    Toggle(L10n.t("account.dailyEnabled"), isOn: Binding(
                        get: { preferences?.dailyEnabled ?? true },
                        set: { setDailyEnabled($0) }
                    ))
                    .tint(theme.colors.primary)
                } header: {
                    Text(L10n.t("account.emailPrefs")).eyebrowStyle(theme.colors)
                } footer: {
                    Text(L10n.t("account.emailPrefsFooter"))
                }

                Section {
                    Button(L10n.t("account.changePassword")) {
                        showsPasswordSheet = true
                    }
                    .foregroundStyle(theme.colors.foreground)
                } header: {
                    Text(L10n.t("account.password")).eyebrowStyle(theme.colors)
                }

                if let referrals {
                    Section {
                        LabeledContent(L10n.t("account.referralCode"), value: referrals.code)
                        ShareLink(item: URL(string: referrals.shareUrl) ?? environment.api.baseURL) {
                            Label(L10n.t("account.referralLink"), systemImage: "link")
                        }
                        ForEach(referrals.referrals) { entry in
                            HStack {
                                Image(systemName: entry.status == "rewarded" ? "gift.fill" : "envelope")
                                    .foregroundStyle(theme.colors.primary)
                                Text(statusLabel(entry.status))
                                    .font(AppFont.geist(14))
                                Spacer()
                                Text(DateFormatting.shortDate(DateFormatting.parseISO8601(entry.createdAt)))
                                    .font(AppFont.geist(12))
                                    .foregroundStyle(theme.colors.mutedForeground)
                            }
                        }
                    } header: {
                        Text(L10n.t("account.referrals")).eyebrowStyle(theme.colors)
                    } footer: {
                        Text(L10n.t("account.referralsFooter"))
                    }
                }

                Section {
                    Button(L10n.t("account.exportAction")) {
                        exportData()
                    }
                    .foregroundStyle(theme.colors.foreground)
                } header: {
                    Text(L10n.t("account.export")).eyebrowStyle(theme.colors)
                }

                Section {
                    Button(L10n.t("account.signOut"), role: .destructive) {
                        signOut()
                    }
                    .disabled(isSigningOut)
                    Button(L10n.t("account.delete"), role: .destructive) {
                        showsDeleteConfirm = true
                    }
                }
                Section {
                    LabeledContent(L10n.t("account.api"), value: environment.api.baseURL.absoluteString)
                    Link(L10n.t("account.manageWeb"), destination: environment.api.baseURL.appending(path: "account"))
                } header: {
                    Text(L10n.t("account.about")).eyebrowStyle(theme.colors)
                }
            }
            .paperScreen()
            .navigationTitle(L10n.t("tabs.account"))
            .task { await loadAccountData() }
            .sheet(isPresented: $showsPasswordSheet) {
                ChangePasswordSheet()
            }
            .sheet(isPresented: $showsUsernameSheet) {
                UsernameSheet(initial: editUsername)
            }
            .sheet(item: $exportURL) { url in
                ShareSheet(items: [url])
            }
            .confirmationDialog(
                L10n.t("account.deleteConfirm.title"),
                isPresented: $showsDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button(L10n.t("account.deleteConfirm.action"), role: .destructive) {
                    Task { await environment.auth.deleteAccount() }
                }
            } message: {
                Text(L10n.t("account.deleteConfirm.body"))
            }
        }
    }

    @State private var editUsername = ""
    @State private var showsUsernameSheet = false

    private func loadAccountData() async {
        let prefs: EmailPreferencesResponse? = try? await environment.api.get(Endpoints.meEmailPreferences)
        if let prefs {
            preferences = prefs.preferences
        }
        let refs: ReferralsResponse? = try? await environment.api.get(Endpoints.meReferrals)
        if let refs {
            referrals = refs
        }
    }

    private func changeLanguage(_ language: String) {
        Task {
            try? await environment.auth.updateProfile(uiLanguage: language)
        }
    }

    private func setDailyEnabled(_ enabled: Bool) {
        preferences = preferences.map { EmailPreferences(dailyEnabled: enabled, unsubscribedAt: $0.unsubscribedAt) }
            ?? EmailPreferences(dailyEnabled: enabled, unsubscribedAt: nil)
        Task {
            _ = try? await environment.api.sendVoid(
                "PATCH",
                Endpoints.meEmailPreferences,
                json: ["dailyEnabled": enabled]
            )
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "rewarded": return L10n.t("account.referralStatus.rewarded")
        case "signed_up": return L10n.t("account.referralStatus.signed_up")
        default: return L10n.t("account.referralStatus.created")
        }
    }

    private func exportData() {
        Task {
            do {
                let data = try await environment.api.data(Endpoints.meExport)
                let url = FileManager.default.temporaryDirectory
                    .appendingPathComponent("ten-minute-review-export.json")
                try data.write(to: url, options: .atomic)
                exportURL = url
            } catch {
                Haptics.failure()
            }
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

extension URL: Identifiable {
    public var id: String { absoluteString }
}

private struct UsernameSheet: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
    @Environment(\.dismiss) private var dismiss
    let initial: String

    @State private var name = ""
    @State private var isBusy = false

    var body: some View {
        NavigationStack {
            Form {
                TextField(L10n.t("account.name"), text: $name)
            }
            .paperScreen()
            .navigationTitle(L10n.t("account.name"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("classrooms.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("settings.saved")) {
                        isBusy = true
                        Task {
                            try? await environment.auth.updateProfile(username: name)
                            isBusy = false
                            dismiss()
                        }
                    }
                    .disabled(isBusy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { name = initial }
        }
    }
}

private struct ChangePasswordSheet: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
    @Environment(\.dismiss) private var dismiss

    @State private var current = ""
    @State private var next = ""
    @State private var isBusy = false
    @State private var message: String?
    @State private var isError = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField(L10n.t("account.currentPassword"), text: $current)
                        .textContentType(.password)
                    SecureField(L10n.t("account.newPassword"), text: $next)
                        .textContentType(.newPassword)
                } footer: {
                    if let message {
                        Text(message).foregroundStyle(isError ? theme.colors.destructive : theme.colors.success)
                    }
                }
            }
            .paperScreen()
            .navigationTitle(L10n.t("account.changePassword"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("classrooms.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("settings.saved")) { submit() }
                        .disabled(isBusy || next.count < 8 || current.isEmpty)
                }
            }
        }
    }

    private func submit() {
        isBusy = true
        message = nil
        Task {
            defer { isBusy = false }
            do {
                try await environment.auth.changePassword(current: current, next: next)
                Haptics.success()
                message = L10n.t("account.passwordUpdated")
                isError = false
                current = ""
                next = ""
                try? await Task.sleep(for: .seconds(1.2))
                dismiss()
            } catch let error as APIError {
                Haptics.failure()
                isError = true
                message = error.statusCode == 400
                    ? L10n.t("account.wrongPassword")
                    : error.message
            } catch {
                isError = true
                message = L10n.t("quiz.wentWrong")
            }
        }
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

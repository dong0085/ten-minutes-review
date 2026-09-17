import SwiftUI

struct SignInView: View {
    @Environment(ThemeStore.self) private var theme
    @State private var isSignUp = false

    var body: some View {
        ZStack {
            theme.colors.background.ignoresSafeArea()
            LinearGradient(
                colors: [theme.colors.backgroundTint, .clear],
                startPoint: .topLeading,
                endPoint: .center
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    VStack(spacing: 10) {
                        Image(systemName: "books.vertical.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(theme.colors.primary)
                            .accessibilityHidden(true)
                        Text("Ten Minute Review")
                            .font(AppFont.editorial(32))
                            .foregroundStyle(theme.colors.foreground)
                            .multilineTextAlignment(.center)
                        Text(L10n.t("app.tagline"))
                            .font(AppFont.geist(14))
                            .foregroundStyle(theme.colors.mutedForeground)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 48)

                    if isSignUp {
                        SignUpCard {
                            isSignUp = false
                        }
                    } else {
                        SignInCard(showSignUp: $isSignUp)
                    }
                }
                .padding(24)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
}

private struct SignInCard: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
    @Binding var showSignUp: Bool

    @State private var email = ""
    @State private var password = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 0) {
                TextField(L10n.t("signin.email"), text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(AppFont.geist(16))
                    .foregroundStyle(theme.colors.foreground)
                    .padding(16)
                Divider().overlay(theme.colors.border.opacity(0.7))
                SecureField(L10n.t("signin.password"), text: $password)
                    .textContentType(.password)
                    .font(AppFont.geist(16))
                    .foregroundStyle(theme.colors.foreground)
                    .padding(16)
            }
            .editorialSurface()

            Button {
                signIn()
            } label: {
                Group {
                    if isBusy {
                        ProgressView().tint(theme.colors.primaryForeground)
                    } else {
                        Text(L10n.t("signin.title"))
                            .font(AppFont.geist(16, .semibold))
                            .foregroundStyle(theme.colors.primaryForeground)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(theme.colors.primary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .disabled(isBusy || email.isEmpty || password.isEmpty)
            .opacity(email.isEmpty || password.isEmpty ? 0.55 : 1)

            if let errorMessage {
                Text(errorMessage)
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.destructive)
                    .multilineTextAlignment(.center)
            }

            Button(L10n.t("signin.switchToSignUp")) {
                showSignUp = true
            }
            .font(AppFont.geist(13, .medium))
            .foregroundStyle(theme.colors.primary)

            Link(L10n.t("signin.forgot"), destination: forgotURL)
                .font(AppFont.geist(13))
                .foregroundStyle(theme.colors.mutedForeground)
        }
    }

    private var forgotURL: URL {
        environment.api.baseURL.appending(path: "forgot")
    }

    private func signIn() {
        isBusy = true
        errorMessage = nil
        Task {
            defer { isBusy = false }
            do {
                try await environment.auth.signIn(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password
                )
                Haptics.success()
            } catch let error as APIError {
                Haptics.failure()
                errorMessage = error.code == "invalid_credentials"
                    ? L10n.t("signin.noMatch")
                    : error.message
            } catch {
                errorMessage = L10n.t("quiz.wentWrong")
            }
        }
    }
}

private struct SignUpCard: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
    var onDone: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var inviteCode = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 8
            && !inviteCode.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 0) {
                field(L10n.t("signin.email"), text: $email, keyboard: .emailAddress)
                Divider().overlay(theme.colors.border.opacity(0.7))
                SecureField(L10n.t("signin.password"), text: $password)
                    .textContentType(.newPassword)
                    .font(AppFont.geist(16))
                    .foregroundStyle(theme.colors.foreground)
                    .padding(16)
                Divider().overlay(theme.colors.border.opacity(0.7))
                field(L10n.t("signup.invite"), text: $inviteCode, keyboard: .default)
            }
            .editorialSurface()

            Button {
                signUp()
            } label: {
                Group {
                    if isBusy {
                        ProgressView().tint(theme.colors.primaryForeground)
                    } else {
                        Text(L10n.t("signup.submit"))
                            .font(AppFont.geist(16, .semibold))
                            .foregroundStyle(theme.colors.primaryForeground)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(theme.colors.primary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .disabled(isBusy || !canSubmit)
            .opacity(canSubmit ? 1 : 0.55)

            if let errorMessage {
                Text(errorMessage)
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.destructive)
                    .multilineTextAlignment(.center)
            }

            Button(L10n.t("signin.haveAccount")) {
                onDone()
            }
            .font(AppFont.geist(13, .medium))
            .foregroundStyle(theme.colors.primary)
        }
    }

    private func field(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        TextField(placeholder, text: text)
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .font(AppFont.geist(16))
            .foregroundStyle(theme.colors.foreground)
            .padding(16)
    }

    private func signUp() {
        isBusy = true
        errorMessage = nil
        Task {
            defer { isBusy = false }
            do {
                try await environment.auth.signUp(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password,
                    inviteCode: inviteCode.trimmingCharacters(in: .whitespaces)
                )
                Haptics.success()
            } catch let error as APIError {
                Haptics.failure()
                errorMessage = error.message
            } catch {
                errorMessage = L10n.t("signup.genericError")
            }
        }
    }
}

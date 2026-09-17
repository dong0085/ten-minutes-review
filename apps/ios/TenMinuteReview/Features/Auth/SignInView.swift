import SwiftUI

struct SignInView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
    @State private var email = ""
    @State private var password = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

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
                        Text("Ten Minute Review")
                            .font(AppFont.editorial(32))
                            .foregroundStyle(theme.colors.foreground)
                            .multilineTextAlignment(.center)
                        Text("Turn today's notes into tomorrow's quiz.")
                            .font(AppFont.geist(14))
                            .foregroundStyle(theme.colors.mutedForeground)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 48)

                    VStack(spacing: 0) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .font(AppFont.geist(16))
                            .foregroundStyle(theme.colors.foreground)
                            .padding(16)
                        Divider().overlay(theme.colors.border.opacity(0.7))
                        SecureField("Password", text: $password)
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
                                ProgressView()
                                    .tint(theme.colors.primaryForeground)
                            } else {
                                Text("Sign In")
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
                    } else {
                        Text("New here? Create an account on the website first.")
                            .font(AppFont.geist(13))
                            .foregroundStyle(theme.colors.mutedForeground)
                            .multilineTextAlignment(.center)
                    }

                    Link("Open the website", destination: environment.api.baseURL.appending(path: "signup"))
                        .font(AppFont.geist(13, .medium))
                        .foregroundStyle(theme.colors.primary)
                }
                .padding(24)
            }
            .scrollDismissesKeyboard(.interactively)
        }
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
            } catch let error as APIError {
                if error.code == "invalid_credentials" {
                    errorMessage = "That email and password combination didn't match."
                } else {
                    errorMessage = error.message
                }
            } catch {
                errorMessage = "Sign-in failed. Please try again."
            }
        }
    }
}

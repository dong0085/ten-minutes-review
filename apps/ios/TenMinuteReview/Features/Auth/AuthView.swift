import SwiftUI

struct SignInView: View {
    @State private var isSignUp = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 12) {
                        Image("AppLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 88, height: 88)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .accessibilityHidden(true)
                        Text("Ten Minute Review")
                            .font(.title.bold())
                        Text(L10n.t("app.tagline"))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }

                if isSignUp {
                    SignUpForm {
                        isSignUp = false
                    }
                } else {
                    SignInForm(showSignUp: $isSignUp)
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
}

private struct SignInForm: View {
    @Environment(AppEnvironment.self) private var environment
    @Binding var showSignUp: Bool

    @State private var email = ""
    @State private var password = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

    var body: some View {
        Section {
            TextField(L10n.t("signin.email"), text: $email)
                .textContentType(.username)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            SecureField(L10n.t("signin.password"), text: $password)
                .textContentType(.password)
        } footer: {
            if let errorMessage {
                Text(errorMessage).foregroundStyle(.red)
            }
        }

        Section {
            SubmitButton(
                title: L10n.t("signin.title"),
                isBusy: isBusy,
                action: signIn
            )
            .disabled(isBusy || email.isEmpty || password.isEmpty)
        }
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)

        Section {
            Button(L10n.t("signin.switchToSignUp")) {
                showSignUp = true
            }
            Link(L10n.t("signin.forgot"), destination: forgotURL)
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

private struct SignUpForm: View {
    @Environment(AppEnvironment.self) private var environment
    var onDone: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 8
    }

    var body: some View {
        Section {
            TextField(L10n.t("signin.email"), text: $email)
                .textContentType(.username)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            SecureField(L10n.t("signin.password"), text: $password)
                .textContentType(.newPassword)
        } footer: {
            if let errorMessage {
                Text(errorMessage).foregroundStyle(.red)
            }
        }

        Section {
            SubmitButton(
                title: L10n.t("signup.submit"),
                isBusy: isBusy,
                action: signUp
            )
            .disabled(isBusy || !canSubmit)
        }
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)

        Section {
            Button(L10n.t("signin.haveAccount")) {
                onDone()
            }
        }
    }

    private func signUp() {
        isBusy = true
        errorMessage = nil
        Task {
            defer { isBusy = false }
            do {
                try await environment.auth.signUp(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password
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

/// Full-width prominent button that swaps its title for a spinner while busy.
private struct SubmitButton: View {
    let title: String
    let isBusy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title).opacity(isBusy ? 0 : 1)
                if isBusy {
                    ProgressView()
                }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
    }
}

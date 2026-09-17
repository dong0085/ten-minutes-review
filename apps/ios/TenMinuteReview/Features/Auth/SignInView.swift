import SwiftUI

struct SignInView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var email = ""
    @State private var password = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "books.vertical.fill")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            VStack(spacing: 8) {
                Text("Ten Minute Review")
                    .font(.title.bold())
                Text("Turn today's notes into tomorrow's quiz.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .multilineTextAlignment(.center)

            Form {
                Section {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                }
                Section {
                    Button {
                        signIn()
                    } label: {
                        if isBusy {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Sign In").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isBusy || email.isEmpty || password.isEmpty)
                } footer: {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    } else {
                        Text("New here? Create an account on the website first.")
                    }
                }
            }
            .frame(maxHeight: 360)

            Link("Open the website", destination: environment.api.baseURL.appending(path: "signup"))
                .font(.footnote)
            Spacer()
        }
        .padding()
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

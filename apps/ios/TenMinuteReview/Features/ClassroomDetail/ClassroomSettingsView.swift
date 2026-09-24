import SwiftUI

struct ClassroomSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    let model: ClassroomDetailModel
    var onDeleted: () -> Void

    @State private var name = ""
    @State private var targetLanguage = "fr"
    @State private var nativeLanguage = "en"
    @State private var autoStopDays = 7
    @State private var isPaused = false
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var showsDeleteConfirm = false

    private let languages = ["en", "fr", "es", "zh", "hi", "pt", "bn", "ru", "ja", "ko", "vi"]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(L10n.t("classrooms.create.name"), text: $name)
                } header: {
                    Text(L10n.t("settings.classroom"))
                }
                Section {
                    Picker(L10n.t("classrooms.create.studying"), selection: $targetLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                    Picker(L10n.t("classrooms.create.native"), selection: $nativeLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                } header: {
                    Text(L10n.t("settings.languages"))
                }
                Section {
                    Stepper(value: $autoStopDays, in: 1...90) {
                        Text("\(autoStopDays) d")
                    }
                } header: {
                    Text(L10n.t("settings.autoStop"))
                } footer: {
                    Text(L10n.t("settings.autoStopFooter"))
                }
                Section {
                    Toggle(L10n.t("settings.pauseToggle"), isOn: $isPaused)
                        .onChange(of: isPaused) { _, paused in
                            setPaused(paused)
                        }
                } header: {
                    Text(L10n.t("settings.pauseTitle"))
                } footer: {
                    Text(L10n.t("settings.pauseFooter"))
                }
                Section {
                    Button(L10n.t("settings.delete"), role: .destructive) {
                        showsDeleteConfirm = true
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(L10n.t("detail.settings"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("classrooms.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("settings.saved")) { save() }
                        .disabled(isBusy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                name = model.classroom.name
                targetLanguage = model.classroom.targetLanguage
                nativeLanguage = model.classroom.nativeLanguage
                autoStopDays = model.classroom.autoStopDays
                isPaused = model.classroom.isPaused
            }
            .confirmationDialog(
                L10n.t("settings.deleteConfirm.title"),
                isPresented: $showsDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button(L10n.t("settings.deleteConfirm.action"), role: .destructive) {
                    deleteClassroom()
                }
            } message: {
                Text(L10n.t("settings.deleteConfirm.body"))
            }
        }
    }

    private func save() {
        isBusy = true
        errorMessage = nil
        Task {
            defer { isBusy = false }
            do {
                try await model.update(
                    name: name.trimmingCharacters(in: .whitespaces),
                    targetLanguage: targetLanguage,
                    nativeLanguage: nativeLanguage,
                    autoStopDays: autoStopDays
                )
                dismiss()
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = L10n.t("quiz.wentWrong")
            }
        }
    }

    private func setPaused(_ paused: Bool) {
        Task {
            do {
                try await model.setPaused(paused)
            } catch {
                isPaused = !paused
                Haptics.failure()
            }
        }
    }

    private func deleteClassroom() {
        Task {
            do {
                try await model.deleteClassroom()
                onDeleted()
                dismiss()
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = L10n.t("quiz.wentWrong")
            }
        }
    }
}

import SwiftUI

struct ClassroomsView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var model: ClassroomsModel?
    @State private var showsCreateSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    switch model.state {
                    case .loading:
                        ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    case .failed(let message):
                        ContentUnavailableView {
                            Label(L10n.t("classrooms.unavailable"), systemImage: "wifi.exclamationmark")
                        } description: {
                            Text(message)
                        } actions: {
                            Button(L10n.t("classrooms.retry")) { Task { await model.load() } }
                        }
                    case .ready:
                        if model.classrooms.isEmpty {
                            ContentUnavailableView(
                                L10n.t("classrooms.empty.title"),
                                systemImage: "book.closed",
                                description: Text(L10n.t("classrooms.empty.body"))
                            )
                        } else {
                            List {
                                Section {
                                    ForEach(model.classrooms) { classroom in
                                        NavigationLink {
                                            ClassroomDetailView(classroom: classroom)
                                        } label: {
                                            ClassroomRow(classroom: classroom)
                                        }
                                    }
                                } header: {
                                    Text(L10n.t("classrooms.header"))
                                }
                            }
                            .refreshable { await model.load() }
                        }
                    }
                }
            }
            .navigationTitle(L10n.t("classrooms.title"))
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showsCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showsCreateSheet) {
                if let model {
                    CreateClassroomSheet(model: model)
                }
            }
            .task {
                if model == nil {
                    let model = ClassroomsModel(api: environment.api)
                    self.model = model
                    await model.load()
                }
            }
        }
    }
}

private struct ClassroomRow: View {
    let classroom: Classroom

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(classroom.name)
                .font(.headline)
            HStack(spacing: 12) {
                Text("\(classroom.targetLanguage.uppercased()) → \(classroom.nativeLanguage.uppercased())")
                if let bankSize = classroom.bankSize {
                    Label("\(bankSize)", systemImage: "square.stack.3d.up")
                }
                Spacer()
                Label(statusText, systemImage: "circle.fill")
                    .labelStyle(StatusLabelStyle(color: statusColor))
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }

    private var statusText: String {
        if classroom.isPaused { return L10n.t("classroom.status.paused") }
        if classroom.isActive ?? false { return L10n.t("classroom.status.active") }
        return L10n.t("classroom.status.dormant")
    }

    private var statusColor: Color {
        if classroom.isPaused { return .orange }
        if classroom.isActive ?? false { return .green }
        return .secondary
    }
}

/// A small coloured dot followed by the status text.
private struct StatusLabelStyle: LabelStyle {
    let color: Color

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon
                .font(.system(size: 7))
                .foregroundStyle(color)
            configuration.title
        }
    }
}

private struct CreateClassroomSheet: View {
    @Environment(\.dismiss) private var dismiss
    let model: ClassroomsModel?

    @State private var name = ""
    @State private var targetLanguage = "fr"
    @State private var nativeLanguage = "en"
    @State private var isBusy = false
    @State private var errorMessage: String?

    private let languages = [
        "en", "fr", "es", "zh", "hi", "pt", "bn", "ru", "ja", "ko", "vi",
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(L10n.t("classrooms.create.name"), text: $name)
                } header: {
                    Text(L10n.t("classrooms.create.section"))
                }
                Section {
                    Picker(L10n.t("classrooms.create.studying"), selection: $targetLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                    Picker(L10n.t("classrooms.create.native"), selection: $nativeLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                } header: {
                    Text(L10n.t("classrooms.create.languages"))
                } footer: {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(L10n.t("classrooms.create.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("classrooms.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("classrooms.create.submit")) {
                        create()
                    }
                    .disabled(isBusy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func create() {
        guard let model else { return }
        isBusy = true
        errorMessage = nil
        Task {
            defer { isBusy = false }
            do {
                _ = try await model.create(
                    name: name.trimmingCharacters(in: .whitespaces),
                    targetLanguage: targetLanguage,
                    nativeLanguage: nativeLanguage
                )
                dismiss()
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = "Could not create the classroom."
            }
        }
    }
}

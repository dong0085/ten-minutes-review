import SwiftUI

struct ClassroomsView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
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
                                                .editorialSurface()
                                        }
                                        .listRowBackground(Color.clear)
                                        .listRowSeparator(.hidden)
                                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                                    }
                                } header: {
                                    Text(L10n.t("classrooms.header")).eyebrowStyle(theme.colors)
                                }
                            }
                            .paperScreen()
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
    @Environment(ThemeStore.self) private var theme
    let classroom: Classroom

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(classroom.name)
                    .font(AppFont.geist(16, .semibold))
                    .foregroundStyle(theme.colors.foreground)
                Spacer()
                statusBadge
            }
            HStack(spacing: 10) {
                Text("\(classroom.targetLanguage.uppercased()) → \(classroom.nativeLanguage.uppercased())")
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
                if let bankSize = classroom.bankSize {
                    Label("\(bankSize)", systemImage: "square.stack.3d.up")
                        .font(AppFont.geist(12))
                        .foregroundStyle(theme.colors.mutedForeground)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var statusBadge: some View {
        Group {
            if classroom.isPaused {
                Text(L10n.t("classroom.status.paused"))
            } else if classroom.isActive ?? false {
                Text(L10n.t("classroom.status.active"))
            } else {
                Text(L10n.t("classroom.status.dormant"))
            }
        }
        .font(AppFont.geist(11, .semibold))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(badgeColor.opacity(0.14), in: Capsule())
        .foregroundStyle(badgeColor)
    }

    private var badgeColor: Color {
        if classroom.isPaused { return theme.colors.warning }
        if classroom.isActive ?? false { return theme.colors.success }
        return theme.colors.mutedForeground
    }
}

private struct CreateClassroomSheet: View {
    @Environment(ThemeStore.self) private var theme
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
                    Text(L10n.t("classrooms.create.section")).eyebrowStyle(theme.colors)
                }
                Section {
                    Picker(L10n.t("classrooms.create.studying"), selection: $targetLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                    Picker(L10n.t("classrooms.create.native"), selection: $nativeLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                } header: {
                    Text(L10n.t("classrooms.create.languages")).eyebrowStyle(theme.colors)
                } footer: {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(theme.colors.destructive)
                    }
                }
            }
            .paperScreen()
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

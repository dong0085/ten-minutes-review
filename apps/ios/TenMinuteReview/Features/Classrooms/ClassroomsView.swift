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
                            Label("Classrooms unavailable", systemImage: "wifi.exclamationmark")
                        } description: {
                            Text(message)
                        } actions: {
                            Button("Retry") { Task { await model.load() } }
                        }
                    case .ready:
                        if model.classrooms.isEmpty {
                            ContentUnavailableView(
                                "No classrooms yet",
                                systemImage: "book.closed",
                                description: Text("A classroom holds one set of notes and its daily quiz.")
                            )
                        } else {
                            List(model.classrooms) { classroom in
                                NavigationLink {
                                    ClassroomDetailView(classroom: classroom)
                                } label: {
                                    ClassroomRow(classroom: classroom)
                                }
                            }
                            .refreshable { await model.load() }
                        }
                    }
                }
            }
            .navigationTitle("Classrooms")
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
                CreateClassroomSheet(model: model)
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
            HStack {
                Text(classroom.name).font(.headline)
                Spacer()
                statusBadge
            }
            HStack(spacing: 8) {
                Text("\(classroom.targetLanguage.uppercased()) → \(classroom.nativeLanguage.uppercased())")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let bankSize = classroom.bankSize {
                    Label("\(bankSize)", systemImage: "square.stack.3d.up")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var statusBadge: some View {
        Group {
            if classroom.isPaused {
                Text("Paused")
            } else if classroom.isActive ?? false {
                Text("Active")
            } else {
                Text("Dormant")
            }
        }
        .font(.caption2.weight(.semibold))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(badgeColor.opacity(0.15), in: Capsule())
        .foregroundStyle(badgeColor)
    }

    private var badgeColor: Color {
        if classroom.isPaused { return .orange }
        if classroom.isActive ?? false { return .green }
        return .secondary
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
                    TextField("Name", text: $name)
                } header: {
                    Text("Classroom")
                }
                Section {
                    Picker("Studying", selection: $targetLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                    Picker("Native", selection: $nativeLanguage) {
                        ForEach(languages, id: \.self) { Text($0.uppercased()) }
                    }
                } header: {
                    Text("Languages")
                } footer: {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("New Classroom")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
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

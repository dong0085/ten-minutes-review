import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct AddNotesView: View {
    @Environment(\.dismiss) private var dismiss
    let model: ClassroomDetailModel

    private enum Mode: Hashable {
        case text
        case images
    }

    @State private var mode: Mode = .text
    @State private var text = ""
    @State private var photos: [PhotosPickerItem] = []
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var progress: Double?

    private static let maxImages = 10
    private static let maxBytes = 10 * 1024 * 1024

    var body: some View {
        NavigationStack {
            Form {
                Picker("Note type", selection: $mode) {
                    Text(L10n.t("notes.text")).tag(Mode.text)
                    Text(L10n.t("notes.photos")).tag(Mode.images)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)

                switch mode {
                case .text:
                    Section {
                        TextEditor(text: $text)
                            .frame(minHeight: 200)
                            .autocorrectionDisabled()
                    } header: {
                        Text(L10n.t("notes.lessonNotes"))
                    } footer: {
                        Text(L10n.t("notes.lessonHint"))
                    }
                case .images:
                    Section {
                        PhotosPicker(
                            selection: $photos,
                            maxSelectionCount: Self.maxImages,
                            matching: .images
                        ) {
                            Label(L10n.t("notes.choose"), systemImage: "photo.on.rectangle.angled")
                        }
                        ForEach(Array(photos.enumerated()), id: \.offset) { index, item in
                            Label(item.itemIdentifier ?? String(format: L10n.t("notes.photo"), index + 1), systemImage: "photo")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                    } header: {
                        Text(L10n.t("notes.pages"))
                    } footer: {
                        Text(String(format: L10n.t("notes.pagesHint"), Self.maxImages))
                    }
                }

                Section {
                    Button {
                        submit()
                    } label: {
                        if isBusy {
                            VStack(spacing: 8) {
                                if let progress {
                                    ProgressView(value: progress)
                                } else {
                                    ProgressView()
                                }
                            }
                            .frame(maxWidth: .infinity)
                        } else {
                            Text(L10n.t("notes.submit")).frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isBusy || !canSubmit)
                } footer: {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(L10n.t("detail.notes.add"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("classrooms.cancel")) { dismiss() }
                }
            }
        }
    }

    private var canSubmit: Bool {
        switch mode {
        case .text:
            return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .images:
            return !photos.isEmpty
        }
    }

    private func submit() {
        isBusy = true
        errorMessage = nil
        Task {
            defer { isBusy = false; progress = nil }
            do {
                switch mode {
                case .text:
                    try await model.upload(text: text)
                case .images:
                    try await model.upload(files: try await loadSelectedPhotos()) { value in
                        Task { @MainActor in progress = value }
                    }
                }
                Haptics.success()
                dismiss()
            } catch let error as APIError {
                Haptics.failure()
                errorMessage = error.message
            } catch {
                Haptics.failure()
                errorMessage = L10n.t("notes.uploadFailed")
            }
        }
    }

    /// Loads the selected photos as raw data — HEIC passes straight through
    /// to the server, which reads images natively.
    private func loadSelectedPhotos() async throws -> [UploadedFile] {
        var files: [UploadedFile] = []
        for (index, item) in photos.enumerated() {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                continue
            }
            guard data.count <= Self.maxBytes else {
                throw APIError(
                    statusCode: -1,
                    message: String(format: L10n.t("notes.tooLarge"), index + 1)
                )
            }
            let type = item.supportedContentTypes.first ?? UTType.heic
            let ext = type.preferredFilenameExtension ?? "heic"
            let mime = type.preferredMIMEType ?? "image/heic"
            files.append(
                UploadedFile(data: data, filename: "note-\(index + 1).\(ext)", mimeType: mime)
            )
        }
        guard !files.isEmpty else {
            throw APIError(statusCode: -1, message: L10n.t("notes.unreadable"))
        }
        return files
    }
}

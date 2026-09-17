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

    private static let maxImages = 10
    private static let maxBytes = 10 * 1024 * 1024

    var body: some View {
        NavigationStack {
            Form {
                Picker("Note type", selection: $mode) {
                    Text("Typed notes").tag(Mode.text)
                    Text("Photos").tag(Mode.images)
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
                        Text("Lesson notes")
                    } footer: {
                        Text("Vocabulary pairs, phrases, grammar notes — anything from the session.")
                    }
                case .images:
                    Section {
                        PhotosPicker(
                            selection: $photos,
                            maxSelectionCount: Self.maxImages,
                            matching: .images
                        ) {
                            Label("Choose photos", systemImage: "photo.on.rectangle.angled")
                        }
                        ForEach(Array(photos.enumerated()), id: \.offset) { index, item in
                            Label(item.itemIdentifier ?? "Photo \(index + 1)", systemImage: "photo")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                    } header: {
                        Text("Handwritten pages")
                    } footer: {
                        Text("Up to \(Self.maxImages) pages, 10 MB each. Photos are read like handwritten text.")
                    }
                }

                Section {
                    Button {
                        submit()
                    } label: {
                        if isBusy {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Add notes").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isBusy || !canSubmit)
                } footer: {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Add Notes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
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
            defer { isBusy = false }
            do {
                switch mode {
                case .text:
                    try await model.upload(text: text)
                case .images:
                    try await model.upload(files: try await loadSelectedPhotos())
                }
                dismiss()
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = "Upload failed. Please try again."
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
                    message: "Photo \(index + 1) is larger than 10 MB. Pick a smaller version."
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
            throw APIError(statusCode: -1, message: "None of the selected photos could be read.")
        }
        return files
    }
}

import SwiftUI

struct NotesTimelineRow: View {
    let upload: Upload

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if upload.isImage, let imageUrl = upload.imageUrl {
                RemoteImage(urlString: imageUrl)
                    .frame(width: 48, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .accessibilityLabel(Text(L10n.t("upload.photoNote")))
            } else {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(.quaternary)
                    .frame(width: 48, height: 48)
                    .overlay {
                        Image(systemName: "doc.text")
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline) {
                    Text(upload.subject
                        ?? L10n.t(upload.isImage ? "upload.photoNote" : "upload.textNote"))
                        .font(.headline)
                        .lineLimit(1)
                    Spacer()
                    statusLabel
                }
                Text(DateFormatting.dateTime(DateFormatting.parseISO8601(upload.createdAt)))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if !upload.isImage, let text = upload.textContent, !text.isEmpty {
                    Text(text)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var statusLabel: some View {
        Group {
            switch upload.extractionStatus {
            case .done:
                Label(L10n.t("upload.processed"), systemImage: "checkmark.circle.fill")
            case .running:
                Label(L10n.t("upload.processing"), systemImage: "arrow.triangle.2.circlepath")
            case .pending:
                Label(L10n.t("upload.queued"), systemImage: "clock")
            case .failed:
                Label(L10n.t("upload.failed"), systemImage: "exclamationmark.triangle.fill")
            }
        }
        .font(.caption)
        .foregroundStyle(color)
    }

    private var color: Color {
        switch upload.extractionStatus {
        case .done: return .green
        case .running, .pending: return .orange
        case .failed: return .red
        }
    }
}

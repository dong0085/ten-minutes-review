import SwiftUI

struct NotesTimelineRow: View {
    let upload: Upload

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if upload.isImage, let imageUrl = upload.imageUrl {
                RemoteImage(urlString: imageUrl)
                    .frame(width: 52, height: 52)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.quaternary)
                    .frame(width: 52, height: 52)
                    .overlay {
                        Image(systemName: "doc.text")
                            .foregroundStyle(.secondary)
                    }
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(upload.subject ?? (upload.isImage ? "Photo note" : "Text note"))
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                    Spacer()
                    statusChip
                }
                Text(DateFormatting.dateTime(DateFormatting.parseISO8601(upload.createdAt)))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !upload.isImage, let text = upload.textContent, !text.isEmpty {
                    Text(text)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var statusChip: some View {
        Group {
            switch upload.extractionStatus {
            case .done:
                Label("Processed", systemImage: "checkmark.circle.fill")
            case .running:
                Label("Processing…", systemImage: "arrow.triangle.2.circlepath")
            case .pending:
                Label("Queued", systemImage: "clock")
            case .failed:
                Label("Failed", systemImage: "exclamationmark.triangle.fill")
            }
        }
        .font(.caption2)
        .foregroundStyle(color)
        .labelStyle(.titleAndIcon)
    }

    private var color: Color {
        switch upload.extractionStatus {
        case .done: return .green
        case .running, .pending: return .orange
        case .failed: return .red
        }
    }
}

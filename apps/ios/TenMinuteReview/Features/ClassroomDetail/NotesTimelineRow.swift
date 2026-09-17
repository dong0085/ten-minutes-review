import SwiftUI

struct NotesTimelineRow: View {
    @Environment(ThemeStore.self) private var theme
    let upload: Upload

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if upload.isImage, let imageUrl = upload.imageUrl {
                RemoteImage(urlString: imageUrl)
                    .frame(width: 52, height: 52)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            } else {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(theme.colors.muted)
                    .frame(width: 52, height: 52)
                    .overlay {
                        Image(systemName: "doc.text")
                            .foregroundStyle(theme.colors.mutedForeground)
                    }
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(upload.subject ?? (upload.isImage ? "Photo note" : "Text note"))
                        .font(AppFont.geist(14, .semibold))
                        .foregroundStyle(theme.colors.foreground)
                        .lineLimit(1)
                    Spacer()
                    statusChip
                }
                Text(DateFormatting.dateTime(DateFormatting.parseISO8601(upload.createdAt)))
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
                if !upload.isImage, let text = upload.textContent, !text.isEmpty {
                    Text(text)
                        .font(AppFont.geist(12))
                        .foregroundStyle(theme.colors.mutedForeground)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, 4)
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
        .font(AppFont.geist(11))
        .foregroundStyle(color)
        .labelStyle(.titleAndIcon)
    }

    private var color: Color {
        switch upload.extractionStatus {
        case .done: return theme.colors.success
        case .running, .pending: return theme.colors.warning
        case .failed: return theme.colors.destructive
        }
    }
}

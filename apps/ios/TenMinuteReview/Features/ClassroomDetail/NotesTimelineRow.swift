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
                    .accessibilityLabel(Text(L10n.t("upload.photoNote")))
            } else {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(theme.colors.muted)
                    .frame(width: 52, height: 52)
                    .overlay {
                        Image(systemName: "doc.text")
                            .foregroundStyle(theme.colors.mutedForeground)
                    }
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(upload.subject
                        ?? L10n.t(upload.isImage ? "upload.photoNote" : "upload.textNote"))
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
                Label(L10n.t("upload.processed"), systemImage: "checkmark.circle.fill")
            case .running:
                Label(L10n.t("upload.processing"), systemImage: "arrow.triangle.2.circlepath")
            case .pending:
                Label(L10n.t("upload.queued"), systemImage: "clock")
            case .failed:
                Label(L10n.t("upload.failed"), systemImage: "exclamationmark.triangle.fill")
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

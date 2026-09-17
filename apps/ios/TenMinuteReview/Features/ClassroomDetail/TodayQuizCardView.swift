import SwiftUI

struct TodayQuizCardView: View {
    @Environment(ThemeStore.self) private var theme
    let model: ClassroomDetailModel

    var body: some View {
        if let quiz = model.today?.quiz {
            VStack(alignment: .leading, spacing: 6) {
                Text(L10n.t("detail.today.ready"))
                    .font(AppFont.geist(16, .semibold))
                    .foregroundStyle(theme.colors.foreground)
                Text(String(format: L10n.t("detail.today.aboutTen"), quiz.size))
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if let job = model.today?.job {
            HStack(spacing: 10) {
                ProgressView()
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.status == "running"
                        ? L10n.t("detail.today.writing")
                        : L10n.t("detail.today.queued"))
                        .font(AppFont.geist(15, .semibold))
                        .foregroundStyle(theme.colors.foreground)
                    Text(String(
                        format: L10n.t("detail.today.requested"),
                        DateFormatting.dateTime(DateFormatting.parseISO8601(job.requestedAt))
                    ))
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
                }
                Spacer()
                Button(L10n.t("detail.today.cancel"), role: .destructive) {
                    Task { await model.cancelCompose() }
                }
                .font(AppFont.geist(14))
            }
        } else if model.bank.total == 0 {
            VStack(alignment: .leading, spacing: 6) {
                Text(L10n.t("detail.today.noneYet"))
                    .font(AppFont.geist(16, .semibold))
                    .foregroundStyle(theme.colors.foreground)
                Text(L10n.t("detail.today.noneHint"))
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text(L10n.t("detail.today.readyFor"))
                        .font(AppFont.geist(16, .semibold))
                        .foregroundStyle(theme.colors.foreground)
                    Text(String(format: L10n.t("detail.today.pointsInBank"), model.bank.total))
                        .font(AppFont.geist(13))
                        .foregroundStyle(theme.colors.mutedForeground)
                }
                Spacer()
                Button {
                    Task { await model.requestQuiz() }
                } label: {
                    Text(L10n.t("detail.today.write"))
                        .font(AppFont.geist(14, .semibold))
                        .foregroundStyle(theme.colors.primaryForeground)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(theme.colors.primary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

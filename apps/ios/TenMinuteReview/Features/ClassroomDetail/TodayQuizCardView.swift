import SwiftUI

struct TodayQuizCardView: View {
    @Environment(ThemeStore.self) private var theme
    let model: ClassroomDetailModel

    var body: some View {
        if let quiz = model.today?.quiz {
            VStack(alignment: .leading, spacing: 6) {
                Text("Today's quiz is ready")
                    .font(AppFont.geist(16, .semibold))
                    .foregroundStyle(theme.colors.foreground)
                Text("\(quiz.size) questions · about ten minutes")
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if let job = model.today?.job {
            HStack(spacing: 10) {
                ProgressView()
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.status == "running" ? "Writing your quiz…" : "Queued…")
                        .font(AppFont.geist(15, .semibold))
                        .foregroundStyle(theme.colors.foreground)
                    Text("Requested \(DateFormatting.dateTime(DateFormatting.parseISO8601(job.requestedAt)))")
                        .font(AppFont.geist(12))
                        .foregroundStyle(theme.colors.mutedForeground)
                }
                Spacer()
                Button("Cancel", role: .destructive) {
                    Task { await model.cancelCompose() }
                }
                .font(AppFont.geist(14))
            }
        } else if model.bank.total == 0 {
            VStack(alignment: .leading, spacing: 6) {
                Text("No quiz yet")
                    .font(AppFont.geist(16, .semibold))
                    .foregroundStyle(theme.colors.foreground)
                Text("Add notes — extraction builds the bank, and the quiz follows.")
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Ready for today's quiz")
                        .font(AppFont.geist(16, .semibold))
                        .foregroundStyle(theme.colors.foreground)
                    Text("\(model.bank.total) study points in the bank.")
                        .font(AppFont.geist(13))
                        .foregroundStyle(theme.colors.mutedForeground)
                }
                Spacer()
                Button {
                    Task { await model.requestQuiz() }
                } label: {
                    Text("Write quiz")
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

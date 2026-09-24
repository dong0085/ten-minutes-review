import SwiftUI

/// Rows for the Today section: a link into today's quiz, compose progress,
/// or the button that asks for one.
struct TodayQuizCardView: View {
    let model: ClassroomDetailModel

    var body: some View {
        if let quiz = model.today?.quiz {
            NavigationLink {
                QuizRunnerView(quiz: quiz)
            } label: {
                row(
                    title: L10n.t("detail.today.ready"),
                    subtitle: String(format: L10n.t("detail.today.aboutTen"), quiz.size),
                    systemImage: "checklist"
                )
            }
        } else if let job = model.today?.job {
            HStack(spacing: 12) {
                ProgressView()
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.status == "running"
                        ? L10n.t("detail.today.writing")
                        : L10n.t("detail.today.queued"))
                        .font(.headline)
                    Text(String(
                        format: L10n.t("detail.today.requested"),
                        DateFormatting.dateTime(DateFormatting.parseISO8601(job.requestedAt))
                    ))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 2)
            Button(L10n.t("detail.today.cancel"), role: .destructive) {
                Task { await model.cancelCompose() }
            }
        } else if model.bank.total == 0 {
            row(
                title: L10n.t("detail.today.noneYet"),
                subtitle: L10n.t("detail.today.noneHint"),
                systemImage: "tray"
            )
        } else {
            row(
                title: L10n.t("detail.today.readyFor"),
                subtitle: String(format: L10n.t("detail.today.pointsInBank"), model.bank.total),
                systemImage: "sparkles"
            )
            Button {
                Task { await model.requestQuiz() }
            } label: {
                Label(L10n.t("detail.today.write"), systemImage: "wand.and.stars")
            }
        }
    }

    private func row(title: String, subtitle: String, systemImage: String) -> some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: systemImage)
                .foregroundStyle(.tint)
        }
        .padding(.vertical, 2)
    }
}

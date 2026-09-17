import SwiftUI

struct ResultView: View {
    @Environment(ThemeStore.self) private var theme
    let outcome: SubmitOutcome
    let quiz: Quiz

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                scoreRing
                Text(verdict)
                    .font(AppFont.geist(14))
                    .foregroundStyle(theme.colors.mutedForeground)

                ForEach(outcome.results, id: \.questionId) { result in
                    ResultRowView(
                        result: result,
                        question: quiz.questions.first { $0.id == result.questionId }
                    )
                }
            }
            .padding()
        }
        .background(theme.colors.background.ignoresSafeArea())
        .navigationTitle(L10n.t("results.title"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var scoreRing: some View {
        let ratio = outcome.questionCount > 0
            ? Double(outcome.correctCount) / Double(outcome.questionCount)
            : 0
        return ZStack {
            Circle()
                .stroke(theme.colors.border.opacity(0.5), lineWidth: 12)
            Circle()
                .trim(from: 0, to: ratio)
                .stroke(theme.colors.primary, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(outcome.correctCount)/\(outcome.questionCount)")
                    .font(AppFont.editorial(34, bold: true))
                    .foregroundStyle(theme.colors.foreground)
                Text(L10n.t("results.correct"))
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
        }
        .frame(width: 140, height: 140)
        .padding(.top, 12)
    }

    private var verdict: String {
        let ratio = outcome.questionCount > 0
            ? Double(outcome.correctCount) / Double(outcome.questionCount)
            : 0
        if ratio >= 0.9 { return L10n.t("results.verdict.great") }
        if ratio >= 0.7 { return L10n.t("results.verdict.solid") }
        if ratio >= 0.5 { return L10n.t("results.verdict.half") }
        return L10n.t("results.verdict.rough")
    }
}

struct ResultRowView: View {
    @Environment(ThemeStore.self) private var theme
    let result: QuestionResult
    let question: QuizQuestion?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: result.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(result.isCorrect ? theme.colors.success : theme.colors.destructive)
                VStack(alignment: .leading, spacing: 6) {
                    Text(question?.stem ?? "")
                        .font(AppFont.geist(15, .semibold))
                        .foregroundStyle(theme.colors.foreground)

                    if !result.isCorrect {
                        Text(String(format: L10n.t("results.correctAnswer"), result.correctAnswer.describe(options: question?.options)))
                            .font(AppFont.geist(14))
                            .foregroundStyle(theme.colors.success)
                    }

                    Text(result.explanation)
                        .font(AppFont.geist(13))
                        .foregroundStyle(theme.colors.mutedForeground)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .editorialSurface()
    }
}

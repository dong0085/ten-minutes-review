import SwiftUI

struct ResultView: View {
    let outcome: SubmitOutcome
    let quiz: Quiz

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
                    scoreRing
                    Text(verdict)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }

            Section {
                ForEach(outcome.results, id: \.questionId) { result in
                    ResultRowView(
                        result: result,
                        question: quiz.questions.first { $0.id == result.questionId }
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(L10n.t("results.title"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var ratio: Double {
        outcome.questionCount > 0
            ? Double(outcome.correctCount) / Double(outcome.questionCount)
            : 0
    }

    private var scoreRing: some View {
        ZStack {
            Circle()
                .stroke(.quaternary, lineWidth: 10)
            Circle()
                .trim(from: 0, to: ratio)
                .stroke(.tint, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(outcome.correctCount)/\(outcome.questionCount)")
                    .font(.largeTitle.bold())
                    .monospacedDigit()
                Text(L10n.t("results.correct"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 128, height: 128)
        .accessibilityElement(children: .combine)
    }

    private var verdict: String {
        if ratio >= 0.9 { return L10n.t("results.verdict.great") }
        if ratio >= 0.7 { return L10n.t("results.verdict.solid") }
        if ratio >= 0.5 { return L10n.t("results.verdict.half") }
        return L10n.t("results.verdict.rough")
    }
}

struct ResultRowView: View {
    let result: QuestionResult
    let question: QuizQuestion?

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 4) {
                Text(question?.stem ?? "")
                    .font(.headline)
                if !result.isCorrect {
                    Text(String(format: L10n.t("results.correctAnswer"), result.correctAnswer.describe(options: question?.options)))
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                Text(result.explanation)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: result.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(result.isCorrect ? .green : .red)
        }
        .padding(.vertical, 4)
    }
}

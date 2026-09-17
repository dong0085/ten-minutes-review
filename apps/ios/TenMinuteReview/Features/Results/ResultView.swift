import SwiftUI

struct ResultView: View {
    let outcome: SubmitOutcome
    let quiz: Quiz

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                scoreRing
                Text(verdict)
                    .font(.headline)
                    .foregroundStyle(.secondary)

                ForEach(outcome.results, id: \.questionId) { result in
                    ResultRowView(
                        result: result,
                        question: quiz.questions.first { $0.id == result.questionId }
                    )
                }
            }
            .padding()
        }
        .navigationTitle("Results")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var scoreRing: some View {
        let ratio = outcome.questionCount > 0
            ? Double(outcome.correctCount) / Double(outcome.questionCount)
            : 0
        return ZStack {
            Circle()
                .stroke(Color.secondary.opacity(0.15), lineWidth: 12)
            Circle()
                .trim(from: 0, to: ratio)
                .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(outcome.correctCount)/\(outcome.questionCount)")
                    .font(.system(.largeTitle, design: .rounded).bold())
                Text("correct")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 140, height: 140)
        .padding(.top, 12)
    }

    private var verdict: String {
        let ratio = outcome.questionCount > 0
            ? Double(outcome.correctCount) / Double(outcome.questionCount)
            : 0
        if ratio >= 0.9 { return "Excellent — that stuck." }
        if ratio >= 0.7 { return "Solid. The misses go back in tomorrow's quiz." }
        if ratio >= 0.5 { return "Halfway there — retests will help." }
        return "Rough one. Review the explanations below."
    }
}

struct ResultRowView: View {
    let result: QuestionResult
    let question: QuizQuestion?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: result.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(result.isCorrect ? .green : .red)
                VStack(alignment: .leading, spacing: 6) {
                    Text(question?.stem ?? "")
                        .font(.subheadline.weight(.medium))

                    if !result.isCorrect {
                        Text("Correct answer: \(result.correctAnswer.describe(options: question?.options))")
                            .font(.subheadline)
                            .foregroundStyle(.green)
                    }

                    Text(result.explanation)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
    }
}

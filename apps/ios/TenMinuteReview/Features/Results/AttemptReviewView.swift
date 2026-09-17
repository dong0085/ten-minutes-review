import SwiftUI

struct AttemptReviewView: View {
    @Environment(AppEnvironment.self) private var environment
    let attemptId: String

    @State private var detail: AttemptDetail?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let detail {
                List {
                    Section {
                        HStack {
                            Text("\(detail.attempt.correctCount)/\(detail.attempt.questionCount) correct")
                                .font(.headline)
                            Spacer()
                            Text(DateFormatting.dateTime(DateFormatting.parseISO8601(detail.attempt.submittedAt)))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text("Took \(DateFormatting.duration(ms: detail.attempt.durationMs))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Section("Answers") {
                        ForEach(Array(detail.answers.enumerated()), id: \.element.questionId) { _, answer in
                            ReviewRowView(answer: answer)
                        }
                    }
                }
            } else if let errorMessage {
                ContentUnavailableView(
                    "Review unavailable",
                    systemImage: "exclamationmark.triangle",
                    description: Text(errorMessage)
                )
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Attempt Review")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do {
                detail = try await environment.api.get(Endpoints.attempt(attemptId))
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = "Could not load this attempt."
            }
        }
    }
}

private struct ReviewRowView: View {
    let answer: AttemptAnswer

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: answer.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(answer.isCorrect ? .green : .red)
                Text(answer.stem)
                    .font(.subheadline.weight(.medium))
            }
            if let yours = answer.response?.describe {
                Text("Your answer: \(yours)")
                    .font(.footnote)
                    .foregroundStyle(answer.isCorrect ? .green : .red)
            } else {
                Text("Unanswered")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if !answer.isCorrect {
                Text("Correct answer: \(answer.correctAnswer.describe(options: answer.options))")
                    .font(.footnote)
                    .foregroundStyle(.green)
            }
            Text(answer.explanation)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

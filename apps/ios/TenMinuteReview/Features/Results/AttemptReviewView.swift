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
                        LabeledContent {
                            Text(DateFormatting.dateTime(DateFormatting.parseISO8601(detail.attempt.submittedAt)))
                        } label: {
                            Text(String(format: L10n.t("review.correctCount"), detail.attempt.correctCount, detail.attempt.questionCount))
                                .font(.headline)
                        }
                        Text(String(format: L10n.t("review.took"), DateFormatting.duration(ms: detail.attempt.durationMs)))
                            .foregroundStyle(.secondary)
                    }
                    Section {
                        ForEach(Array(detail.answers.enumerated()), id: \.element.questionId) { _, answer in
                            ReviewRowView(answer: answer)
                        }
                    } header: {
                        Text(L10n.t("review.answers"))
                    }
                }
                .listStyle(.insetGrouped)
            } else if let errorMessage {
                ContentUnavailableView(
                    L10n.t("review.unavailable"),
                    systemImage: "exclamationmark.triangle",
                    description: Text(errorMessage)
                )
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(L10n.t("review.title"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do {
                detail = try await environment.api.get(Endpoints.attempt(attemptId))
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = L10n.t("quiz.wentWrong")
            }
        }
    }
}

private struct ReviewRowView: View {
    let answer: AttemptAnswer

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 4) {
                Text(answer.stem)
                    .font(.headline)
                if let yours = answer.response?.describe {
                    Text(String(format: L10n.t("review.yourAnswer"), yours))
                        .font(.subheadline)
                        .foregroundStyle(answer.isCorrect ? .green : .red)
                } else {
                    Text(L10n.t("review.unanswered"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if !answer.isCorrect {
                    Text(String(format: L10n.t("results.correctAnswer"), answer.correctAnswer.describe(options: answer.options)))
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                Text(answer.explanation)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: answer.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(answer.isCorrect ? .green : .red)
        }
        .padding(.vertical, 4)
    }
}

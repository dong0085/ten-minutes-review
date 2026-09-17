import SwiftUI

struct AttemptReviewView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
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
                                .font(AppFont.geist(16, .semibold))
                                .foregroundStyle(theme.colors.foreground)
                            Spacer()
                            Text(DateFormatting.dateTime(DateFormatting.parseISO8601(detail.attempt.submittedAt)))
                                .font(AppFont.geist(12))
                                .foregroundStyle(theme.colors.mutedForeground)
                        }
                        Text("Took \(DateFormatting.duration(ms: detail.attempt.durationMs))")
                            .font(AppFont.geist(12))
                            .foregroundStyle(theme.colors.mutedForeground)
                    }
                    Section {
                        ForEach(Array(detail.answers.enumerated()), id: \.element.questionId) { _, answer in
                            ReviewRowView(answer: answer)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        }
                    } header: {
                        Text("Answers").eyebrowStyle(theme.colors)
                    }
                }
                .paperScreen()
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
    @Environment(ThemeStore.self) private var theme
    let answer: AttemptAnswer

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: answer.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(answer.isCorrect ? theme.colors.success : theme.colors.destructive)
                Text(answer.stem)
                    .font(AppFont.geist(15, .semibold))
                    .foregroundStyle(theme.colors.foreground)
            }
            if let yours = answer.response?.describe {
                Text("Your answer: \(yours)")
                    .font(AppFont.geist(13))
                    .foregroundStyle(answer.isCorrect ? theme.colors.success : theme.colors.destructive)
            } else {
                Text("Unanswered")
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
            if !answer.isCorrect {
                Text("Correct answer: \(answer.correctAnswer.describe(options: answer.options))")
                    .font(AppFont.geist(13))
                    .foregroundStyle(theme.colors.success)
            }
            Text(answer.explanation)
                .font(AppFont.geist(13))
                .foregroundStyle(theme.colors.mutedForeground)
        }
        .padding(14)
        .editorialSurface()
    }
}

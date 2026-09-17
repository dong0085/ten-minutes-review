import SwiftUI

struct TodayQuizCardView: View {
    let model: ClassroomDetailModel

    var body: some View {
        if let quiz = model.today?.quiz {
            NavigationLink {
                QuizRunnerView(quiz: quiz)
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Today's quiz is ready")
                            .font(.headline)
                        Text("\(quiz.size) questions · about ten minutes")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "arrow.right.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.tint)
                }
                .padding(.vertical, 4)
            }
        } else if let job = model.today?.job {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    ProgressView()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(job.status == "running" ? "Writing your quiz…" : "Queued…")
                            .font(.headline)
                        Text("Requested \(DateFormatting.dateTime(DateFormatting.parseISO8601(job.requestedAt)))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Cancel", role: .destructive) {
                        Task { await model.cancelCompose() }
                    }
                    .font(.callout)
                }
            }
            .padding(.vertical, 4)
        } else if model.bank.total == 0 {
            VStack(alignment: .leading, spacing: 4) {
                Text("No quiz yet")
                    .font(.headline)
                Text("Add notes — extraction builds the bank, and the quiz follows.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
        } else {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Ready for today's quiz")
                        .font(.headline)
                    Text("\(model.bank.total) study points in the bank.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Write quiz") {
                    Task { await model.requestQuiz() }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.vertical, 4)
        }
    }
}

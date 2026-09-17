import SwiftUI

struct QuizRunnerView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var model: QuizRunnerModel?
    let quiz: Quiz

    var body: some View {
        Group {
            if let model {
                switch model.phase {
                case .loading:
                    ProgressView("Preparing your quiz…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .running:
                    RunningQuizView(model: model)
                case .submitting:
                    ProgressView("Scoring…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .done(let outcome):
                    ResultView(outcome: outcome, quiz: quiz)
                case .recovered(let attemptId):
                    AttemptReviewView(attemptId: attemptId)
                case .expired:
                    ContentUnavailableView(
                        "This attempt expired",
                        systemImage: "clock.badge.exclamationmark",
                        description: Text("Attempts stay open for two hours. Try again for a fresh one.")
                    )
                case .failed(let message):
                    ContentUnavailableView {
                        Label("Something went wrong", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Try again") {
                            Task { await model.retry() }
                        }
                    }
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Quiz")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if model == nil {
                let model = QuizRunnerModel(
                    quiz: quiz,
                    api: environment.api,
                    drafts: environment.drafts,
                    userId: environment.auth.user?.id ?? "unknown"
                )
                self.model = model
                await model.start()
            }
        }
    }
}

private struct RunningQuizView: View {
    let model: QuizRunnerModel

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if model.resumed {
                    Label(
                        "Resumed — \(timeRemaining(model.secondsRemaining)) left",
                        systemImage: "clock.arrow.circlepath"
                    )
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                ProgressView(
                    value: Double(model.current + 1),
                    total: Double(max(model.questions.count, 1))
                )

                HStack {
                    Text("Question \(model.current + 1) of \(model.questions.count)")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    Text("\(model.answeredCount) answered")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let question = model.currentQuestion {
                    QuestionContainerView(model: model, question: question)
                }

                controls
            }
            .padding()
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private var controls: some View {
        HStack {
            Button {
                model.previous()
            } label: {
                Label("Previous", systemImage: "chevron.left")
            }
            .disabled(model.current == 0)

            Spacer()

            if model.current == model.questions.count - 1 {
                Button {
                    Task { await model.submit() }
                } label: {
                    Label("Submit", systemImage: "checkmark.circle.fill")
                        .font(.headline)
                }
                .buttonStyle(.borderedProminent)
            } else {
                Button {
                    model.next()
                } label: {
                    Label("Next", systemImage: "chevron.right")
                        .font(.headline)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(.top, 8)
    }

    private func timeRemaining(_ seconds: Int?) -> String {
        guard let seconds else { return "time" }
        let minutes = seconds / 60
        return "\(max(minutes, 0)) min"
    }
}

private struct QuestionContainerView: View {
    let model: QuizRunnerModel
    let question: QuizQuestion

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(question.category.rawValue.capitalized)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(.tint.opacity(0.1), in: Capsule())

            switch question.type {
            case .mcq:
                MCQQuestionView(
                    question: question,
                    order: model.optionOrder(for: question),
                    selection: selectionBinding
                )
            case .image:
                VStack(alignment: .leading, spacing: 16) {
                    RemoteImage(urlString: question.imageUrl ?? "")
                        .frame(maxHeight: 260)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    MCQQuestionView(
                        question: question,
                        order: model.optionOrder(for: question),
                        selection: selectionBinding
                    )
                }
            case .trueFalse:
                TrueFalseQuestionView(selection: boolBinding)
            case .fillBlank:
                FillBlankQuestionView(question: question, onChange: fillBlankChange)
            }

            Text(question.stem)
                .font(.body)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var selectionBinding: Binding<Int?> {
        Binding(
            get: { model.answer(for: question)?.index },
            set: { newValue in
                if let newValue {
                    model.record(.index(newValue), for: question)
                }
            }
        )
    }

    private var boolBinding: Binding<Bool?> {
        Binding(
            get: { model.answer(for: question)?.value },
            set: { newValue in
                if let newValue {
                    model.record(.value(newValue), for: question)
                }
            }
        )
    }

    private func fillBlankChange(_ blanks: [String]) {
        model.record(.blanks(blanks), for: question)
    }
}

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
                    ProgressView(L10n.t("quiz.preparing"))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .running:
                    RunningQuizView(model: model)
                case .submitting:
                    ProgressView(L10n.t("quiz.scoring"))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .done(let outcome):
                    ResultView(outcome: outcome, quiz: quiz)
                case .recovered(let attemptId):
                    AttemptReviewView(attemptId: attemptId)
                case .expired:
                    ContentUnavailableView(
                        L10n.t("quiz.expired.title"),
                        systemImage: "clock.badge.exclamationmark",
                        description: Text(L10n.t("quiz.expired.body"))
                    )
                case .failed(let message):
                    ContentUnavailableView {
                        Label(L10n.t("quiz.wentWrong"), systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(message)
                    } actions: {
                        Button(L10n.t("quiz.tryAgain")) {
                            Task { await model.retry() }
                        }
                    }
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(L10n.t("quiz.title"))
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
    @Environment(ThemeStore.self) private var theme
    let model: QuizRunnerModel

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if model.resumed {
                    Label(
                        String(format: L10n.t("quiz.resumed"), minutesRemaining(model.secondsRemaining)),
                        systemImage: "clock.arrow.circlepath"
                    )
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.warning)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                ProgressView(
                    value: Double(model.current + 1),
                    total: Double(max(model.questions.count, 1))
                )
                .tint(theme.colors.primary)

                HStack {
                    Text(String(format: L10n.t("quiz.questionOf"), model.current + 1, model.questions.count))
                        .font(AppFont.geist(14, .medium))
                        .foregroundStyle(theme.colors.foreground)
                    Spacer()
                    Text(String(format: L10n.t("quiz.answered"), model.answeredCount))
                        .font(AppFont.geist(12))
                        .foregroundStyle(theme.colors.mutedForeground)
                }

                if let question = model.currentQuestion {
                    QuestionContainerView(model: model, question: question)
                }

                controls
            }
            .padding()
        }
        .background(theme.colors.background.ignoresSafeArea())
        .scrollBounceBehavior(.basedOnSize)
    }

    private var controls: some View {
        HStack {
            Button {
                model.previous()
            } label: {
                Label(L10n.t("quiz.previous"), systemImage: "chevron.left")
            }
            .disabled(model.current == 0)

            Spacer()

            if model.current == model.questions.count - 1 {
                Button {
                    Task { await model.submit() }
                } label: {
                    Text(L10n.t("quiz.submit"))
                        .font(AppFont.geist(16, .semibold))
                        .foregroundStyle(theme.colors.primaryForeground)
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.borderedProminent)
            } else {
                Button {
                    model.next()
                } label: {
                    Label(L10n.t("quiz.next"), systemImage: "chevron.right")
                        .font(AppFont.geist(16, .semibold))
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(.top, 8)
    }

    private func minutesRemaining(_ seconds: Int?) -> Int {
        guard let seconds else { return 0 }
        return max(seconds / 60, 0)
    }
}

private struct QuestionContainerView: View {
    @Environment(ThemeStore.self) private var theme
    let model: QuizRunnerModel
    let question: QuizQuestion

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(question.category.rawValue.capitalized)
                .font(AppFont.geist(11, .semibold))
                .kerning(2)
                .textCase(.uppercase)
                .foregroundStyle(theme.colors.primary)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(theme.colors.secondary, in: Capsule())

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
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
                .font(AppFont.geist(17))
                .foregroundStyle(theme.colors.foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var selectionBinding: Binding<Int?> {
        Binding(
            get: { model.answer(for: question)?.index },
            set: { newValue in
                if let newValue {
                    Haptics.tap()
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
                    Haptics.tap()
                    model.record(.value(newValue), for: question)
                }
            }
        )
    }

    private func fillBlankChange(_ blanks: [String]) {
        model.record(.blanks(blanks), for: question)
    }
}

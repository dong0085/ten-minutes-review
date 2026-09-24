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
    let model: QuizRunnerModel

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    ProgressView(
                        value: Double(model.current + 1),
                        total: Double(max(model.questions.count, 1))
                    )
                    HStack {
                        Text(String(format: L10n.t("quiz.questionOf"), model.current + 1, model.questions.count))
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        Text(String(format: L10n.t("quiz.answered"), model.answeredCount))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)

                if model.resumed {
                    Label(
                        String(format: L10n.t("quiz.resumed"), minutesRemaining(model.secondsRemaining)),
                        systemImage: "clock.arrow.circlepath"
                    )
                    .font(.subheadline)
                    .foregroundStyle(.orange)
                }
            }

            if let question = model.currentQuestion {
                QuestionSections(model: model, question: question)
                    .id(question.id)
            }
        }
        .listStyle(.insetGrouped)
        .scrollDismissesKeyboard(.interactively)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .bottomBar) {
                Button {
                    model.previous()
                } label: {
                    Label(L10n.t("quiz.previous"), systemImage: "chevron.left")
                }
                .disabled(model.current == 0)
            }
            ToolbarItem(placement: .bottomBar) {
                Spacer()
            }
            ToolbarItem(placement: .bottomBar) {
                if model.current == model.questions.count - 1 {
                    Button(L10n.t("quiz.submit")) {
                        Task { await model.submit() }
                    }
                    .buttonStyle(.borderedProminent)
                } else {
                    Button {
                        model.next()
                    } label: {
                        Label(L10n.t("quiz.next"), systemImage: "chevron.right")
                            .labelStyle(.titleAndIcon)
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
    }

    private func minutesRemaining(_ seconds: Int?) -> Int {
        guard let seconds else { return 0 }
        return max(seconds / 60, 0)
    }
}

/// The prompt section and the answer section for one question.
private struct QuestionSections: View {
    let model: QuizRunnerModel
    let question: QuizQuestion

    var body: some View {
        Section {
            if question.type == .image {
                RemoteImage(urlString: question.imageUrl ?? "")
                    .frame(maxWidth: .infinity, maxHeight: 260)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .listRowInsets(EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12))
            }
            Text(question.stem)
                .font(.title3)
                .padding(.vertical, 4)
        } header: {
            Text(question.category.rawValue.capitalized)
        }

        Section {
            switch question.type {
            case .mcq, .image:
                MCQQuestionView(
                    question: question,
                    order: model.optionOrder(for: question),
                    selection: selectionBinding
                )
            case .trueFalse:
                TrueFalseQuestionView(selection: boolBinding)
            case .fillBlank:
                FillBlankQuestionView(
                    question: question,
                    initial: model.answer(for: question)?.blanks ?? [],
                    onChange: fillBlankChange
                )
            }
        }
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

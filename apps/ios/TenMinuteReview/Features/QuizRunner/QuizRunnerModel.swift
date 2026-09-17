import Foundation
import Observation

struct SubmitItem: Encodable {
    let questionId: String
    let response: AnswerPayload
    let durationMs: Int
}

@MainActor
@Observable
final class QuizRunnerModel {
    enum Phase {
        case loading
        case running
        case submitting
        case done(SubmitOutcome)
        case recovered(attemptId: String)
        case expired
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    let quiz: Quiz
    private(set) var resumed = false

    private(set) var answers: [String: AnswerDraft] = [:]
    private(set) var optionOrders: [String: [Int]] = [:]
    private(set) var current = 0

    private var draft: QuizDraft?
    private var questionStartedAt = Date()
    private var durations: [String: Int] = [:]

    private let api: APIClient
    private let drafts: DraftStore
    private let userId: String

    /// Server-side attempt tokens live for two hours from first start.
    private static let attemptTTL: TimeInterval = 2 * 60 * 60

    init(quiz: Quiz, api: APIClient, drafts: DraftStore, userId: String) {
        self.quiz = quiz
        self.api = api
        self.drafts = drafts
        self.userId = userId
    }

    var questions: [QuizQuestion] {
        quiz.questions
    }

    var currentQuestion: QuizQuestion? {
        questions.indices.contains(current) ? questions[current] : nil
    }

    var answeredCount: Int {
        questions.filter { answers[$0.id]?.payload.isAnswered == true }.count
    }

    var secondsRemaining: Int? {
        guard let draft else { return nil }
        return draft.secondsRemaining
    }

    func start() async {
        if let existing = drafts.load(userId: userId, quizId: quiz.id) {
            if existing.isExpired {
                drafts.remove(userId: userId, quizId: quiz.id)
            } else {
                draft = existing
                answers = existing.responses
                optionOrders = existing.optionOrders
                durations = existing.durations
                current = min(existing.current, max(questions.count - 1, 0))
                resumed = true
                phase = .running
                return
            }
        }
        await startNewAttempt()
    }

    func retry() async {
        phase = .loading
        await startNewAttempt()
    }

    func record(_ payload: AnswerPayload, for question: QuizQuestion) {
        answers[question.id] = AnswerDraft.from(payload)
        persist()
    }

    func answer(for question: QuizQuestion) -> AnswerDraft? {
        answers[question.id]
    }

    func moveTo(_ index: Int) {
        if let question = currentQuestion {
            durations[question.id] = elapsed(for: question.id)
        }
        current = min(max(index, 0), max(questions.count - 1, 0))
        questionStartedAt = Date()
        persist()
    }

    func next() {
        moveTo(current + 1)
    }

    func previous() {
        moveTo(current - 1)
    }

    /// The shuffled display order for one question's options. Original
    /// indexes are kept and submitted — only the display order shuffles.
    func optionOrder(for question: QuizQuestion) -> [Int] {
        if let existing = optionOrders[question.id] {
            return existing
        }
        let count = question.options?.count ?? 0
        guard count > 0 else { return [] }
        let order = shuffledIndexOrder(count: count)
        optionOrders[question.id] = order
        persist()
        return order
    }

    func submit() async {
        guard let draft else { return }
        phase = .submitting
        if let question = currentQuestion {
            durations[question.id] = elapsed(for: question.id)
        }
        struct SubmitBody: Encodable {
            let attemptToken: String
            let responses: [SubmitItem]
            let durationMs: Int
        }
        let responses = questions.map { question in
            SubmitItem(
                questionId: question.id,
                response: answers[question.id]?.payload ?? unansweredPayload(for: question),
                durationMs: durations[question.id] ?? 0
            )
        }
        let body = SubmitBody(
            attemptToken: draft.attemptToken,
            responses: responses,
            durationMs: durations.values.reduce(0, +)
        )
        do {
            let outcome: SubmitOutcome = try await api.send("POST", Endpoints.submitAttempt, json: body)
            drafts.remove(userId: userId, quizId: quiz.id)
            phase = .done(outcome)
        } catch let error as APIError where error.statusCode == 400 && error.code == "attempt_invalid" {
            drafts.remove(userId: userId, quizId: quiz.id)
            phase = .expired
        } catch let error as APIError where error.statusCode == 400 && error.code == nil {
            // "Already submitted" — likely a retry after a lost response.
            // Recover by finding the recorded attempt for this quiz.
            if let attemptId = await latestAttemptId(since: draft.startedAt) {
                drafts.remove(userId: userId, quizId: quiz.id)
                phase = .recovered(attemptId: attemptId)
            } else {
                phase = .failed(error.message)
            }
        } catch let error as APIError {
            phase = .failed(error.message)
        } catch {
            phase = .failed("Could not submit the attempt.")
        }
    }

    // MARK: Internals

    private func startNewAttempt() async {
        do {
            let start: AttemptStart = try await api.send("POST", Endpoints.attempts(quizID: quiz.id))
            draft = QuizDraft(
                version: 1,
                attemptToken: start.attemptToken,
                startedAt: Date(),
                expiresAt: Date().addingTimeInterval(Self.attemptTTL),
                responses: [:],
                optionOrders: [:],
                durations: [:],
                current: 0,
                savedAt: Date()
            )
            answers = [:]
            optionOrders = [:]
            durations = [:]
            current = 0
            resumed = false
            persist()
            phase = .running
        } catch let error as APIError {
            phase = .failed(error.message)
        } catch {
            phase = .failed("Could not start the quiz.")
        }
    }

    private func unansweredPayload(for question: QuizQuestion) -> AnswerPayload {
        switch question.type {
        case .mcq, .image:
            return .index(nil)
        case .trueFalse:
            return .value(nil)
        case .fillBlank:
            return .blanks([])
        }
    }

    private func elapsed(for questionId: String) -> Int {
        guard !questionId.isEmpty else { return 0 }
        let now = Int(Date().timeIntervalSince(questionStartedAt) * 1000)
        return max(0, durations[questionId, default: 0] + now)
    }

    private func persist() {
        guard var draft else { return }
        draft.responses = answers
        draft.optionOrders = optionOrders
        draft.durations = durations
        draft.current = current
        draft.savedAt = Date()
        drafts.save(draft, userId: userId, quizId: quiz.id)
    }

    private func latestAttemptId(since startedAt: Date) async -> String? {
        struct AttemptListEntry: Decodable {
            let id: String
            let submittedAt: String
        }
        struct QuizWithAttempts: Decodable {
            let attempts: [AttemptListEntry]?
        }
        guard
            let response: QuizWithAttempts = try? await api.get(
                "\(Endpoints.quiz(quiz.id))?includeAttempts=1"
            ),
            let attempts = response.attempts
        else { return nil }
        return attempts
            .compactMap { entry -> (String, Date)? in
                guard let date = DateFormatting.parseISO8601(entry.submittedAt) else { return nil }
                return (entry.id, date)
            }
            .filter { $0.1 >= startedAt.addingTimeInterval(-5) }
            .max { $0.1 < $1.1 }?
            .0
    }
}

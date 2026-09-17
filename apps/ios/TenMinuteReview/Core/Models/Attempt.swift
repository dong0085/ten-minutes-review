struct AttemptStart: Decodable {
    let attemptToken: String
    let questions: [QuizQuestion]
}

struct QuestionResult: Decodable, Hashable {
    let questionId: String
    let isCorrect: Bool
    let correctAnswer: CorrectAnswer
    let explanation: String
}

struct SubmitOutcome: Decodable {
    let attemptId: String
    let correctCount: Int
    let questionCount: Int
    let results: [QuestionResult]
}

struct AttemptSummary: Decodable, Hashable {
    let id: String
    let quizId: String
    let submittedAt: String
    let correctCount: Int
    let questionCount: Int
    let durationMs: Int
}

struct AttemptAnswer: Decodable, Hashable {
    let questionId: String
    let position: Int
    let category: Category
    let type: QuestionType
    let stem: String
    let options: [String]?
    let response: StoredResponse?
    let isCorrect: Bool
    let correctAnswer: CorrectAnswer
    let explanation: String
}

struct AttemptDetail: Decodable {
    let attempt: AttemptSummary
    let answers: [AttemptAnswer]
}

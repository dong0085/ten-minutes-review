enum Category: String, Codable, Hashable {
    case vocabulary
    case phrase
    case grammar
    case expression
    case comprehension
}

enum QuestionType: String, Codable, Hashable {
    case mcq
    case fillBlank = "fill_blank"
    case trueFalse = "true_false"
    case image
}

struct QuizQuestion: Codable, Identifiable, Hashable {
    let id: String
    let position: Int
    let category: Category
    let type: QuestionType
    let stem: String
    let options: [String]?
    let imageUrl: String?
}

struct Quiz: Codable, Identifiable, Hashable {
    let id: String
    let quizDate: String
    let size: Int
    let classroomId: String
    let classroomName: String
    let questions: [QuizQuestion]
}

struct QuizResponse: Decodable {
    let quiz: Quiz
}

struct ComposeJob: Codable, Hashable {
    let status: String
    let requestedAt: String
}

struct TodayQuizResponse: Decodable {
    let quiz: Quiz?
    let job: ComposeJob?
}

struct QuizSummary: Codable, Identifiable, Hashable {
    let id: String
    let quizDate: String
    let kind: String
    let size: Int
    let composedAt: String
    let bestScore: Int?
    let attemptCount: Int
}

struct QuizListResponse: Decodable {
    let quizzes: [QuizSummary]
}

struct QuizCancelled: Decodable {
    let outcome: String
}

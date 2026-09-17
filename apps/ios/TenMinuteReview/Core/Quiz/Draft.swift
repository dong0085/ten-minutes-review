import Foundation

/// An in-progress attempt, persisted locally so the learner can leave and
/// resume within the two-hour attempt window — the same behaviour as the
/// web client's localStorage draft.
struct QuizDraft: Codable {
    let version: Int
    let attemptToken: String
    let startedAt: Date
    let expiresAt: Date
    var responses: [String: AnswerDraft]
    var optionOrders: [String: [Int]]
    var durations: [String: Int]
    var current: Int
    var savedAt: Date

    var isExpired: Bool { expiresAt < Date() }

    var secondsRemaining: Int {
        max(0, Int(expiresAt.timeIntervalSinceNow))
    }
}

/// AnswerDraft keeps AnswerPayload's semantics with Codable round-tripping:
/// only the field matching the question type is written.
struct AnswerDraft: Codable, Hashable {
    var index: Int?
    var value: Bool?
    var blanks: [String]?

    var payload: AnswerPayload {
        if let index { return .index(index) }
        if let value { return .value(value) }
        if let blanks { return .blanks(blanks) }
        return .blanks([])
    }

    static func from(_ payload: AnswerPayload) -> AnswerDraft {
        switch payload {
        case .index(let index): return AnswerDraft(index: index, value: nil, blanks: nil)
        case .value(let value): return AnswerDraft(index: nil, value: value, blanks: nil)
        case .blanks(let blanks): return AnswerDraft(index: nil, value: nil, blanks: blanks)
        }
    }
}

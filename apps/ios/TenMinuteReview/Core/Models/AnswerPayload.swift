import Foundation

/// The graded answer, revealed after submit. Its shape depends on question
/// type: mcq/image carry an option index, true_false a boolean, fill_blank a
/// list with one entry per blank.
enum CorrectAnswer: Decodable, Hashable {
    case index(Int)
    case value(Bool)
    case blanks([String])

    private enum CodingError: Error {
        case unexpectedShape
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let index = try? container.decode(Int.self) {
            self = .index(index)
            return
        }
        if let value = try? container.decode(Bool.self) {
            self = .value(value)
            return
        }
        if let blanks = try? container.decode([String].self) {
            self = .blanks(blanks)
            return
        }
        throw CodingError.unexpectedShape
    }

    /// A display string for review screens. `options` is the question's
    /// options array, when known, so MCQ answers show the option text.
    func describe(options: [String]?) -> String {
        switch self {
        case .index(let index):
            if let options, options.indices.contains(index) {
                return options[index]
            }
            return "Option \(index + 1)"
        case .value(let value):
            return value ? "True" : "False"
        case .blanks(let blanks):
            return blanks.joined(separator: ", ")
        }
    }
}

/// The learner's in-progress answer for one question, submitted with the
/// attempt. Unanswered questions encode as an empty object — the server
/// grades every question and records the misses.
enum AnswerPayload: Encodable, Hashable {
    case index(Int?)
    case value(Bool?)
    case blanks([String])

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .index(let index):
            try container.encodeIfPresent(index, forKey: .index)
        case .value(let value):
            try container.encodeIfPresent(value, forKey: .value)
        case .blanks(let blanks):
            try container.encode(blanks, forKey: .blanks)
        }
    }

    var isAnswered: Bool {
        switch self {
        case .index(let index): index != nil
        case .value(let value): value != nil
        case .blanks(let blanks): !blanks.isEmpty
        }
    }

    private enum CodingKeys: String, CodingKey {
        case index
        case value
        case blanks
    }
}

/// The stored response as it comes back in attempt review.
struct StoredResponse: Decodable, Hashable {
    let index: Int?
    let blanks: [String?]?
    let value: Bool?

    var describe: String? {
        if let index {
            return "Option \(index + 1)"
        }
        if let value {
            return value ? "True" : "False"
        }
        if let blanks, !blanks.isEmpty {
            return blanks.compactMap { $0 }.joined(separator: ", ")
        }
        return nil
    }
}

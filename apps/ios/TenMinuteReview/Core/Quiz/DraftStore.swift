import Foundation

final class DraftStore {
    private let root: URL

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        root = support.appendingPathComponent("Drafts", isDirectory: true)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    func load(userId: String, quizId: String) -> QuizDraft? {
        let url = fileURL(userId: userId, quizId: quizId)
        guard let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(QuizDraft.self, from: data)
    }

    func save(_ draft: QuizDraft, userId: String, quizId: String) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(draft) else { return }
        try? FileManager.default.createDirectory(
            at: directory(userId: userId),
            withIntermediateDirectories: true
        )
        try? data.write(to: fileURL(userId: userId, quizId: quizId), options: .atomic)
    }

    func remove(userId: String, quizId: String) {
        try? FileManager.default.removeItem(at: fileURL(userId: userId, quizId: quizId))
    }

    func removeAll(userId: String) {
        try? FileManager.default.removeItem(at: directory(userId: userId))
    }

    private func directory(userId: String) -> URL {
        root.appendingPathComponent(userId, isDirectory: true)
    }

    private func fileURL(userId: String, quizId: String) -> URL {
        directory(userId: userId).appendingPathComponent("\(quizId).json")
    }
}

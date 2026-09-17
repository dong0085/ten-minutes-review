struct Classroom: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let targetLanguage: String
    let nativeLanguage: String
    let autoStopDays: Int
    let activeUntil: String?
    let pausedAt: String?
    let dailyResumedAt: String?
    let archivedAt: String?
    let includeAnswersInEmail: Bool?
    let isActive: Bool?
    let bankSize: Int?
    let todayQuizId: String?

    var isPaused: Bool { pausedAt != nil }
}

struct ClassroomsResponse: Decodable {
    let classrooms: [Classroom]
}

struct ClassroomResponse: Decodable {
    let classroom: Classroom
}

enum Endpoints {
    static let authToken = "/api/auth/token"
    static let authTokenRevoke = "/api/auth/token/revoke"
    static let classrooms = "/api/classrooms"
    static let me = "/api/me"

    static func classroom(_ id: String) -> String { "/api/classrooms/\(id)" }
    static func uploads(classroomID: String) -> String { "/api/classrooms/\(classroomID)/uploads" }
    static func bank(classroomID: String) -> String { "/api/classrooms/\(classroomID)/bank" }
    static func quizzesToday(classroomID: String) -> String { "/api/classrooms/\(classroomID)/quizzes/today" }
    static func quizzes(classroomID: String) -> String { "/api/classrooms/\(classroomID)/quizzes" }
    static func cancelQuiz(classroomID: String) -> String { "/api/classrooms/\(classroomID)/quizzes/cancel" }
    static func quiz(_ id: String) -> String { "/api/quizzes/\(id)" }
    static func attempts(quizID: String) -> String { "/api/quizzes/\(quizID)/attempts" }
    static let submitAttempt = "/api/attempts/submit"
    static func attempt(_ id: String) -> String { "/api/attempts/\(id)" }
}

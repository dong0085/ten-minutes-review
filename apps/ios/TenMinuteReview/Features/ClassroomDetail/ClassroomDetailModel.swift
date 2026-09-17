import Foundation
import Observation

@MainActor
@Observable
final class ClassroomDetailModel {
    enum State {
        case loading
        case ready
        case failed(String)
    }

    private(set) var state: State = .loading
    private(set) var classroom: Classroom
    private(set) var uploads: [Upload] = []
    private(set) var bank = BankSummary(counts: [:], total: 0)
    private(set) var quizzes: [QuizSummary] = []
    private(set) var today: TodayQuizResponse?

    private let api: APIClient
    private var pollTask: Task<Void, Never>?

    init(classroom: Classroom, api: APIClient) {
        self.classroom = classroom
        self.api = api
    }

    func loadAll() async {
        do {
            async let classroomResponse: ClassroomResponse = api.get(Endpoints.classroom(classroom.id))
            async let uploadsResponse: UploadsResponse = api.get(Endpoints.uploads(classroomID: classroom.id))
            async let bankResponse: BankResponse = api.get(Endpoints.bank(classroomID: classroom.id))
            async let quizList: QuizListResponse = api.get(Endpoints.quizzes(classroomID: classroom.id))
            async let todayResponse: TodayQuizResponse = api.get(Endpoints.quizzesToday(classroomID: classroom.id))
            let (c, u, b, q, t) = try await (classroomResponse, uploadsResponse, bankResponse, quizList, todayResponse)
            classroom = c.classroom
            uploads = u.uploads
            bank = b.summary
            quizzes = q.quizzes
            today = t
            state = .ready
        } catch let error as APIError {
            state = .failed(error.message)
        } catch {
            state = .failed("Could not load this classroom.")
        }
    }

    func refreshToday() async {
        guard let response: TodayQuizResponse = try? await api.get(
            Endpoints.quizzesToday(classroomID: classroom.id)
        ) else { return }
        today = response
    }

    func refreshUploads() async {
        guard let response: UploadsResponse = try? await api.get(
            Endpoints.uploads(classroomID: classroom.id)
        ) else { return }
        uploads = response.uploads
    }

    func refreshQuizzes() async {
        guard let response: QuizListResponse = try? await api.get(
            Endpoints.quizzes(classroomID: classroom.id)
        ) else { return }
        quizzes = response.quizzes
    }

    func requestQuiz() async {
        _ = try? await api.sendVoid("POST", Endpoints.quizzes(classroomID: classroom.id))
        await refreshToday()
        startPolling()
    }

    func cancelCompose() async {
        _ = try? await api.sendVoid("POST", Endpoints.cancelQuiz(classroomID: classroom.id))
        await refreshToday()
    }

    func loadQuiz(id: String) async throws -> Quiz {
        let response: QuizResponse = try await api.get("\(Endpoints.quiz(id))?includeAttempts=1")
        await refreshQuizzes()
        return response.quiz
    }

    func update(
        name: String,
        targetLanguage: String,
        nativeLanguage: String,
        autoStopDays: Int
    ) async throws {
        struct UpdateBody: Encodable {
            let name: String
            let targetLanguage: String
            let nativeLanguage: String
            let autoStopDays: Int
        }
        let response: ClassroomResponse = try await api.send(
            "PATCH",
            Endpoints.classroom(classroom.id),
            json: UpdateBody(
                name: name,
                targetLanguage: targetLanguage,
                nativeLanguage: nativeLanguage,
                autoStopDays: autoStopDays
            )
        )
        classroom = response.classroom
    }

    func setPaused(_ paused: Bool) async throws {
        let response: ClassroomResponse = try await api.send(
            "PATCH",
            Endpoints.classroom(classroom.id),
            json: ["paused": paused]
        )
        classroom = response.classroom
    }

    func deleteClassroom() async throws {
        _ = try await api.sendVoid("DELETE", Endpoints.classroom(classroom.id))
    }

    func deleteQuiz(id: String) async throws {
        _ = try await api.sendVoid("DELETE", Endpoints.quiz(id))
        if today?.quiz?.id == id {
            await refreshToday()
        }
        await refreshQuizzes()
    }

    func upload(text: String) async throws {
        struct TextBody: Encodable {
            let text: String
        }
        _ = try await api.sendVoid("POST", Endpoints.uploads(classroomID: classroom.id), json: TextBody(text: text))
        await refreshUploads()
    }

    func upload(files: [UploadedFile], progress: (@Sendable (Double) -> Void)? = nil) async throws {
        let accepted: UploadAccepted = try await api.upload(
            Endpoints.uploads(classroomID: classroom.id),
            files: files,
            progress: progress
        )
        guard !accepted.uploadIds.isEmpty else { return }
        await refreshUploads()
    }

    /// Polls today's quiz while a compose job is in flight (the server keeps
    /// the job visible for ten minutes after the request).
    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                guard self.today?.job != nil, self.today?.quiz == nil else { break }
                try? await Task.sleep(for: .seconds(5))
                guard !Task.isCancelled else { break }
                await self.refreshToday()
            }
        }
    }
}

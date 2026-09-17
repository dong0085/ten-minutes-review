import Foundation
import Observation

@MainActor
@Observable
final class ClassroomsModel {
    enum State {
        case loading
        case ready
        case failed(String)
    }

    private(set) var state: State = .loading
    private(set) var classrooms: [Classroom] = []

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func load() async {
        do {
            let response: ClassroomsResponse = try await api.get(Endpoints.classrooms)
            classrooms = response.classrooms
            state = .ready
        } catch let error as APIError {
            state = .failed(error.message)
        } catch {
            state = .failed("Could not load classrooms.")
        }
    }

    func create(name: String, targetLanguage: String, nativeLanguage: String) async throws -> Classroom {
        let response: ClassroomResponse = try await api.send("POST", Endpoints.classrooms, json: [
            "name": name,
            "targetLanguage": targetLanguage,
            "nativeLanguage": nativeLanguage,
        ])
        classrooms.insert(response.classroom, at: 0)
        return response.classroom
    }
}

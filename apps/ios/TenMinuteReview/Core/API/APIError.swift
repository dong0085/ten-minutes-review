import Foundation

struct APIError: Error, LocalizedError {
    let statusCode: Int
    let code: String?
    let message: String

    var errorDescription: String? { message }

    init(statusCode: Int, code: String? = nil, message: String) {
        self.statusCode = statusCode
        self.code = code
        self.message = message
    }

    static func from(data: Data, statusCode: Int) -> APIError {
        struct Body: Decodable {
            let error: String?
            let code: String?
        }
        let body = try? JSONDecoder().decode(Body.self, from: data)
        return APIError(
            statusCode: statusCode,
            code: body?.code,
            message: body?.error ?? "Request failed (\(statusCode))"
        )
    }

    static func wrapping(_ error: URLError) -> APIError {
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
            return APIError(statusCode: -1, code: "offline", message: "You appear to be offline.")
        case .timedOut:
            return APIError(statusCode: -1, code: "timeout", message: "The request timed out.")
        default:
            return APIError(statusCode: -1, code: nil, message: error.localizedDescription)
        }
    }
}

import Foundation

private struct AnyEncodable: Encodable {
    private let encodeTo: (Encoder) throws -> Void
    init(_ wrapped: any Encodable) {
        encodeTo = wrapped.encode(to:)
    }
    func encode(to encoder: Encoder) throws {
        try encodeTo(encoder)
    }
}

final class APIClient {
    let baseURL: URL
    var bearerToken: String?
    var onUnauthorized: (() -> Void)?

    private let session: URLSession

    init(baseURL: URL) {
        self.baseURL = baseURL
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 90
        configuration.timeoutIntervalForResource = 300
        session = URLSession(configuration: configuration)
    }

    // MARK: Requests

    func get<Response: Decodable>(_ path: String) async throws -> Response {
        try await decode(await send("GET", path))
    }

    func send<Response: Decodable>(_ method: String, _ path: String, json: (any Encodable)? = nil) async throws -> Response {
        var body: Data?
        if let json {
            body = try JSONEncoder().encode(AnyEncodable(json))
        }
        return try await decode(await send(method, path, body: body))
    }

    func sendVoid(_ method: String, _ path: String, json: (any Encodable)? = nil) async throws {
        var body: Data?
        if let json {
            body = try JSONEncoder().encode(AnyEncodable(json))
        }
        _ = try await send(method, path, body: body)
    }

    func upload<Response: Decodable>(_ path: String, files: [UploadedFile]) async throws -> Response {
        var form = MultipartFormData()
        for file in files {
            form.add(file: file)
        }
        var request = try buildRequest("POST", path)
        request.httpBody = form.finalized()
        request.setValue(form.contentTypeHeader, forHTTPHeaderField: "Content-Type")
        return try await decode(await run(request))
    }

    /// Fetches raw bytes (image files) with the bearer header when the URL
    /// points at the API origin.
    func rawData(at url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        if url.host == baseURL.host, let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let status = (response as? HTTPURLResponse)?.statusCode ?? -1
                throw APIError.from(data: data, statusCode: status)
            }
            return data
        } catch let error as APIError {
            throw error
        } catch let error as URLError {
            throw APIError.wrapping(error)
        }
    }

    // MARK: Internals

    private func decode<Response: Decodable>(_ data: Data) throws -> Response {
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError(statusCode: -1, message: "Could not read the server response.")
        }
    }

    private func send(_ method: String, _ path: String, body: Data? = nil) async throws -> Data {
        var request = try buildRequest(method, path)
        request.httpBody = body
        return try await run(request)
    }

    private func buildRequest(_ method: String, _ path: String) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError(statusCode: -1, message: "Invalid request path: \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func run(_ request: URLRequest) async throws -> Data {
        let attachedToken = request.value(forHTTPHeaderField: "Authorization") != nil
        let data: Data
        let status: Int
        do {
            let (body, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError(statusCode: -1, message: "The server response was unreadable.")
            }
            data = body
            status = http.statusCode
        } catch let error as URLError {
            throw APIError.wrapping(error)
        }
        guard (200..<300).contains(status) else {
            if status == 401 && attachedToken {
                onUnauthorized?()
            }
            throw APIError.from(data: data, statusCode: status)
        }
        return data
    }
}

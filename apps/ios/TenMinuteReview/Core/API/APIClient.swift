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
    private let cacheDirectory: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 90
        configuration.timeoutIntervalForResource = 300
        session = URLSession(configuration: configuration)
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        cacheDirectory = caches.appendingPathComponent("api-snapshots", isDirectory: true)
        try? FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    // MARK: Requests

    func get<Response: Decodable>(_ path: String) async throws -> Response {
        try await decode(await send("GET", path, cacheable: true))
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

    /// Raw bytes for a path that returns a file (the data export).
    func data(_ path: String) async throws -> Data {
        try await send("GET", path)
    }

    func upload<Response: Decodable>(
        _ path: String,
        files: [UploadedFile],
        progress: (@Sendable (Double) -> Void)? = nil
    ) async throws -> Response {
        var form = MultipartFormData()
        for file in files {
            form.add(file: file)
        }
        var request = try buildRequest("POST", path)
        let body = form.finalized()
        request.httpBody = body
        request.setValue(form.contentTypeHeader, forHTTPHeaderField: "Content-Type")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await withCheckedThrowingContinuation { continuation in
                let task = self.session.uploadTask(with: request, from: body) { data, response, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: (data ?? Data(), response ?? URLResponse()))
                    }
                }
                if let progress {
                    self.observeProgress(of: task, progress)
                }
                task.resume()
            }
            guard let http = response as? HTTPURLResponse else {
                throw APIError(statusCode: -1, message: "The server response was unreadable.")
            }
            guard (200..<300).contains(http.statusCode) else {
                if http.statusCode == 401 {
                    onUnauthorized?()
                }
                throw APIError.from(data: data, statusCode: http.statusCode)
            }
        } catch let error as APIError {
            throw error
        } catch let error as URLError {
            throw APIError.wrapping(error)
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError(statusCode: -1, message: "Could not read the server response.")
        }
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

    private func send(_ method: String, _ path: String, body: Data? = nil, cacheable: Bool = false) async throws -> Data {
        var request = try buildRequest(method, path)
        request.httpBody = body
        do {
            return try await run(request, cacheable: cacheable && method == "GET", path: path)
        } catch let error as APIError where error.code == "offline" {
            // Offline: fall back to the last successful snapshot for reads.
            guard cacheable, let snapshot = readSnapshot(path: path) else { throw error }
            return snapshot
        }
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

    private func run(_ request: URLRequest, cacheable: Bool = false, path: String? = nil) async throws -> Data {
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
        if cacheable, let path {
            writeSnapshot(data, path: path)
        }
        return data
    }

    private func observeProgress(of task: URLSessionUploadTask, _ report: @escaping (Double) -> Void) {
        let progress = task.progress
        Task.detached { [weak progress] in
            while let progress, !progress.isFinished, !progress.isCancelled {
                await MainActor.run { report(progress.fractionCompleted) }
                try? await Task.sleep(for: .milliseconds(120))
            }
        }
    }

    private func snapshotURL(path: String) -> URL {
        let safe = path
            .replacingOccurrences(of: "/", with: "_")
            .addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? path
        return cacheDirectory.appendingPathComponent("\(safe).json")
    }

    private func writeSnapshot(_ data: Data, path: String) {
        try? data.write(to: snapshotURL(path: path), options: .atomic)
    }

    private func readSnapshot(path: String) -> Data? {
        try? Data(contentsOf: snapshotURL(path: path))
    }
}

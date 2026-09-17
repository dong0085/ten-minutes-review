import Foundation

struct UploadedFile {
    let data: Data
    let filename: String
    let mimeType: String
}

struct MultipartFormData {
    private let boundary = "Boundary-\(UUID().uuidString)"
    private var body = Data()

    var contentTypeHeader: String {
        "multipart/form-data; boundary=\(boundary)"
    }

    mutating func add(file: UploadedFile, name: String = "files") {
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data(
            "Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(file.filename)\"\r\n".utf8
        ))
        body.append(Data("Content-Type: \(file.mimeType)\r\n\r\n".utf8))
        body.append(file.data)
        body.append(Data("\r\n".utf8))
    }

    func finalized() -> Data {
        var final = body
        final.append(Data("--\(boundary)--\r\n".utf8))
        return final
    }
}

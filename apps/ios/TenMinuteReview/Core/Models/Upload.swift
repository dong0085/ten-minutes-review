enum ExtractionStatus: String, Codable, Hashable {
    case pending
    case running
    case done
    case failed
}

struct Upload: Codable, Identifiable, Hashable {
    let id: String
    let kind: String
    let textContent: String?
    let originalFilename: String?
    let mimeType: String?
    let byteSize: Int?
    let extractionStatus: ExtractionStatus
    let extractedAt: String?
    let extractionError: String?
    let subject: String?
    let discardedCount: Int?
    let createdAt: String
    let imageUrl: String?

    var isImage: Bool { kind == "image" }
}

struct UploadsResponse: Decodable {
    let uploads: [Upload]
}

struct UploadAccepted: Decodable {
    let uploadIds: [String]
}

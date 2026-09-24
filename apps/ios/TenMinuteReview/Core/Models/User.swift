struct PublicUser: Codable, Identifiable, Hashable {
    let id: String
    let email: String
    let username: String?
    let avatarUrl: String?
    let uiLanguage: String
    let uiTheme: String?
    let timezone: String
    let emailVerifiedAt: String?
    let createdAt: String
}

struct UserResponse: Decodable {
    let user: PublicUser
}

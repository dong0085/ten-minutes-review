struct EmailPreferences: Codable, Hashable {
    let dailyEnabled: Bool
    let unsubscribedAt: String?
}

struct EmailPreferencesResponse: Decodable {
    let preferences: EmailPreferences
}

struct ReferralEntry: Decodable, Identifiable, Hashable {
    let id: String
    let referredUserId: String?
    let status: String
    let rewardMonths: Int
    let createdAt: String
    let rewardedAt: String?
}

struct ReferralsResponse: Decodable {
    let code: String
    let shareUrl: String
    let referrals: [ReferralEntry]
}

struct OkResponse: Decodable {
    let ok: Bool
}

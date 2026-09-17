import Foundation

enum DateFormatting {
    private static let iso8601Fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Plain = ISO8601DateFormatter()

    /// Server timestamps are ISO 8601 with millisecond precision, e.g.
    /// `2026-09-17T15:47:31.773Z`.
    static func parseISO8601(_ string: String) -> Date? {
        iso8601Fractional.date(from: string) ?? iso8601Plain.date(from: string)
    }

    /// Quiz dates arrive as `YYYY-MM-DD`.
    static func parseQuizDate(_ string: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: string)
    }

    static func shortDate(_ date: Date?) -> String {
        guard let date else { return "" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    static func quizDateLabel(_ string: String) -> String {
        shortDate(parseQuizDate(string))
    }

    static func dateTime(_ date: Date?) -> String {
        guard let date else { return "" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    static func duration(ms: Int) -> String {
        let seconds = ms / 1000
        let minutes = seconds / 60
        if minutes >= 1 {
            return "\(minutes)m \(seconds % 60)s"
        }
        return "\(seconds)s"
    }
}

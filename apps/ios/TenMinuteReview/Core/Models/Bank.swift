struct BankSummary: Codable, Hashable {
    let counts: [String: Int]
    let total: Int

    var orderedCounts: [(label: String, count: Int)] {
        ["vocabulary", "phrase", "grammar", "expression", "comprehension"].compactMap { key in
            counts[key].map { (label: key, count: $0) }
        }
    }
}

struct BankResponse: Decodable {
    let counts: [String: Int]
    let total: Int

    var summary: BankSummary { BankSummary(counts: counts, total: total) }
}

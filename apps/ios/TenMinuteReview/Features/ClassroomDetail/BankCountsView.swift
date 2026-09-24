import SwiftUI

/// Rows for the question bank section: the total, then one row per category.
struct BankCountsView: View {
    let bank: BankSummary

    var body: some View {
        if bank.total == 0 {
            Text(L10n.t("detail.bank.empty"))
                .foregroundStyle(.secondary)
        } else {
            Text(String(format: L10n.t("detail.bank.total"), bank.total))
                .font(.headline)
            ForEach(bank.orderedCounts, id: \.label) { entry in
                LabeledContent(entry.label.capitalized) {
                    Text("\(entry.count)")
                        .monospacedDigit()
                }
            }
        }
    }
}

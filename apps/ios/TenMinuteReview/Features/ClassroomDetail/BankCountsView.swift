import SwiftUI

struct BankCountsView: View {
    let bank: BankSummary

    var body: some View {
        if bank.total == 0 {
            Text("The bank fills up as notes are processed.")
                .foregroundStyle(.secondary)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Text("\(bank.total) points total")
                    .font(.subheadline.weight(.medium))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(bank.orderedCounts, id: \.label) { entry in
                            HStack(spacing: 4) {
                                Text(entry.label.capitalized)
                                Text("\(entry.count)")
                                    .font(.caption.weight(.semibold))
                            }
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(.tint.opacity(0.1), in: Capsule())
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }
}

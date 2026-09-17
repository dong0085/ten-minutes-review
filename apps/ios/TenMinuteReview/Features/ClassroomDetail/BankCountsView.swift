import SwiftUI

struct BankCountsView: View {
    @Environment(ThemeStore.self) private var theme
    let bank: BankSummary

    var body: some View {
        if bank.total == 0 {
            Text(L10n.t("detail.bank.empty"))
                .font(AppFont.geist(13))
                .foregroundStyle(theme.colors.mutedForeground)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text(String(format: L10n.t("detail.bank.total"), bank.total))
                    .font(AppFont.geist(14, .medium))
                    .foregroundStyle(theme.colors.foreground)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(bank.orderedCounts, id: \.label) { entry in
                            HStack(spacing: 4) {
                                Text(entry.label.capitalized)
                                    .font(AppFont.geist(12))
                                Text("\(entry.count)")
                                    .font(AppFont.geist(12, .semibold))
                            }
                            .foregroundStyle(theme.colors.secondaryForeground)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(theme.colors.secondary, in: Capsule())
                        }
                    }
                }
            }
        }
    }
}

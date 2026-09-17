import SwiftUI

/// Options render in shuffled order; the original index travels with the
/// selection so grading stays stable.
struct MCQQuestionView: View {
    @Environment(ThemeStore.self) private var theme
    let question: QuizQuestion
    let order: [Int]
    @Binding var selection: Int?

    var body: some View {
        VStack(spacing: 10) {
            ForEach(order, id: \.self) { originalIndex in
                let text = question.options?.indices.contains(originalIndex) == true
                    ? question.options?[originalIndex] ?? ""
                    : ""
                optionButton(text: text, index: originalIndex)
            }
        }
    }

    private func optionButton(text: String, index: Int) -> some View {
        let selected = selection == index
        return Button {
            selection = index
        } label: {
            HStack {
                Text(text)
                    .font(AppFont.geist(15))
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(selected ? theme.colors.accentForeground : theme.colors.foreground)
                Spacer()
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(theme.colors.primary)
                }
            }
            .padding(14)
            .background(
                selected ? theme.colors.accent : theme.colors.card,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(selected ? Color.clear : theme.colors.border.opacity(0.7), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct TrueFalseQuestionView: View {
    @Environment(ThemeStore.self) private var theme
    @Binding var selection: Bool?

    var body: some View {
        HStack(spacing: 12) {
            choice(L10n.t("quiz.true"), value: true, icon: "checkmark.circle")
            choice(L10n.t("quiz.false"), value: false, icon: "xmark.circle")
        }
    }

    private func choice(_ label: String, value: Bool, icon: String) -> some View {
        let selected = selection == value
        return Button {
            selection = value
        } label: {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(selected ? theme.colors.primary : theme.colors.mutedForeground)
                Text(label)
                    .font(AppFont.geist(16, .semibold))
                    .foregroundStyle(selected ? theme.colors.accentForeground : theme.colors.foreground)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(
                selected ? theme.colors.accent : theme.colors.card,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(selected ? Color.clear : theme.colors.border.opacity(0.7), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

/// Fill-in-the-blank questions carry one blank per run of underscores in the
/// stem; each blank gets its own field.
struct FillBlankQuestionView: View {
    @Environment(ThemeStore.self) private var theme
    let question: QuizQuestion
    let onChange: ([String]) -> Void

    @State private var blanks: [String] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(0..<blankCount, id: \.self) { index in
                VStack(alignment: .leading, spacing: 4) {
                    Text(String(format: L10n.t("quiz.blank"), index + 1))
                        .font(AppFont.geist(11, .semibold))
                        .foregroundStyle(theme.colors.mutedForeground)
                    TextField(L10n.t("quiz.yourAnswer"), text: binding(for: index))
                        .font(AppFont.geist(16))
                        .padding(12)
                        .background(theme.colors.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .strokeBorder(theme.colors.input, lineWidth: 1)
                        }
                        .autocorrectionDisabled()
                        .onSubmit { commit() }
                }
            }
            if blankCount == 0 {
                TextField(L10n.t("quiz.yourAnswer"), text: singleFallback)
                    .font(AppFont.geist(16))
                    .padding(12)
                    .background(theme.colors.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(theme.colors.input, lineWidth: 1)
                    }
                    .autocorrectionDisabled()
                    .onSubmit { commit() }
            }
        }
        .onAppear {
            if blanks.isEmpty {
                blanks = Array(repeating: "", count: blankCount)
            }
        }
    }

    private var blankCount: Int {
        guard let regex = try? NSRegularExpression(pattern: "_{3,}") else { return 0 }
        let range = NSRange(question.stem.startIndex..., in: question.stem)
        return regex.numberOfMatches(in: question.stem, range: range)
    }

    private func binding(for index: Int) -> Binding<String> {
        Binding(
            get: { blanks.indices.contains(index) ? blanks[index] : "" },
            set: { newValue in
                if blanks.indices.contains(index) {
                    blanks[index] = newValue
                    commit()
                }
            }
        )
    }

    private var singleFallback: Binding<String> {
        Binding(
            get: { blanks.first ?? "" },
            set: { newValue in
                blanks = [newValue]
                commit()
            }
        )
    }

    private func commit() {
        onChange(blanks.map { $0.trimmingCharacters(in: .whitespaces) })
    }
}

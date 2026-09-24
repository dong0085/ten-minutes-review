import SwiftUI

/// Options render in shuffled order; the original index travels with the
/// selection so grading stays stable. Each option is a list row with a
/// checkmark, like a system picker.
struct MCQQuestionView: View {
    let question: QuizQuestion
    let order: [Int]
    @Binding var selection: Int?

    var body: some View {
        ForEach(order, id: \.self) { originalIndex in
            let text = question.options?.indices.contains(originalIndex) == true
                ? question.options?[originalIndex] ?? ""
                : ""
            ChoiceRow(title: text, isSelected: selection == originalIndex) {
                selection = originalIndex
            }
        }
    }
}

struct TrueFalseQuestionView: View {
    @Binding var selection: Bool?

    var body: some View {
        ChoiceRow(title: L10n.t("quiz.true"), isSelected: selection == true) {
            selection = true
        }
        ChoiceRow(title: L10n.t("quiz.false"), isSelected: selection == false) {
            selection = false
        }
    }
}

private struct ChoiceRow: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .fontWeight(.semibold)
                        .foregroundStyle(.tint)
                }
            }
            .contentShape(Rectangle())
        }
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Fill-in-the-blank questions carry one blank per run of underscores in the
/// stem; each blank gets its own field.
struct FillBlankQuestionView: View {
    let question: QuizQuestion
    let initial: [String]
    let onChange: ([String]) -> Void

    @State private var blanks: [String] = []

    var body: some View {
        Group {
            if blankCount == 0 {
                TextField(L10n.t("quiz.yourAnswer"), text: singleFallback)
                    .autocorrectionDisabled()
                    .onSubmit { commit() }
            } else {
                ForEach(0..<blankCount, id: \.self) { index in
                    LabeledContent(String(format: L10n.t("quiz.blank"), index + 1)) {
                        TextField(L10n.t("quiz.yourAnswer"), text: binding(for: index))
                            .multilineTextAlignment(.trailing)
                            .autocorrectionDisabled()
                            .onSubmit { commit() }
                    }
                }
            }
        }
        .onAppear {
            if blanks.isEmpty {
                let count = max(blankCount, 1)
                blanks = initial.count == count ? initial : Array(repeating: "", count: count)
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

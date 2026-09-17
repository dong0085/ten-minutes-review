import SwiftUI

/// Options render in shuffled order; the original index travels with the
/// selection so grading stays stable.
struct MCQQuestionView: View {
    let question: QuizQuestion
    let order: [Int]
    @Binding var selection: Int?

    var body: some View {
        VStack(spacing: 10) {
            ForEach(order, id: \.self) { originalIndex in
                let text = question.options?.indices.contains(originalIndex) == true
                    ? question.options?[originalIndex] ?? ""
                    : ""
                Button {
                    selection = originalIndex
                } label: {
                    HStack {
                        Text(text)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        if selection == originalIndex {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.tint)
                        }
                    }
                    .padding(14)
                    .background(
                        selection == originalIndex
                            ? Color.accentColor.opacity(0.14)
                            : Color.secondary.opacity(0.08),
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                    .contentShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct TrueFalseQuestionView: View {
    @Binding var selection: Bool?

    var body: some View {
        HStack(spacing: 12) {
            choice("True", value: true)
            choice("False", value: false)
        }
    }

    private func choice(_ label: String, value: Bool) -> some View {
        Button {
            selection = value
        } label: {
            VStack(spacing: 6) {
                Image(systemName: value ? "checkmark.circle" : "xmark.circle")
                    .font(.title2)
                Text(label)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(
                selection == value
                    ? Color.accentColor.opacity(0.14)
                    : Color.secondary.opacity(0.08),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
    }
}

/// Fill-in-the-blank questions carry one blank per run of underscores in the
/// stem; each blank gets its own field.
struct FillBlankQuestionView: View {
    let question: QuizQuestion
    let onChange: ([String]) -> Void

    @State private var blanks: [String] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(0..<blankCount, id: \.self) { index in
                VStack(alignment: .leading, spacing: 4) {
                    Text("Blank \(index + 1)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("Your answer", text: binding(for: index))
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        .onSubmit { commit() }
                }
            }
            if blankCount == 0 {
                TextField("Your answer", text: singleFallback)
                    .textFieldStyle(.roundedBorder)
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

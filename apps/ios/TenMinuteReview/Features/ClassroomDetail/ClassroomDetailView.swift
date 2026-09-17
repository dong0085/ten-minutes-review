import SwiftUI

struct ClassroomDetailView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var model: ClassroomDetailModel?
    @State private var showsAddNotes = false
    let classroom: Classroom

    var body: some View {
        Group {
            if let model {
                switch model.state {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                case .failed(let message):
                    ContentUnavailableView {
                        Label("Classroom unavailable", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Retry") { Task { await model.loadAll() } }
                    }
                case .ready:
                    List {
                        Section("Today") {
                            TodayQuizCardView(model: model)
                        }
                        Section("Question bank") {
                            BankCountsView(bank: model.bank)
                        }
                        Section("Notes") {
                            if model.uploads.isEmpty {
                                Text("Add your first note to start building the bank.")
                                    .foregroundStyle(.secondary)
                            } else {
                                ForEach(model.uploads) { upload in
                                    NotesTimelineRow(upload: upload)
                                }
                            }
                        }
                        Section("Quizzes") {
                            if model.quizzes.isEmpty {
                                Text("No quizzes yet.")
                                    .foregroundStyle(.secondary)
                            } else {
                                ForEach(model.quizzes) { summary in
                                    NavigationLink {
                                        RetakeView(quizId: summary.id, model: model)
                                    } label: {
                                        QuizListRow(summary: summary)
                                    }
                                }
                            }
                        }
                    }
                    .refreshable { await model.loadAll() }
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(classroom.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showsAddNotes = true
                } label: {
                    Label("Add notes", systemImage: "plus.square")
                }
            }
        }
        .sheet(isPresented: $showsAddNotes) {
            if let model {
                AddNotesView(model: model)
            }
        }
        .task {
            if model == nil {
                let model = ClassroomDetailModel(classroom: classroom, api: environment.api)
                self.model = model
                await model.loadAll()
            }
        }
    }
}

private struct QuizListRow: View {
    let summary: QuizSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(DateFormatting.quizDateLabel(summary.quizDate))
                    .font(.headline)
                if summary.kind == "manual" {
                    Text("On demand")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.blue.opacity(0.12), in: Capsule())
                        .foregroundStyle(.blue)
                }
                Spacer()
                Text("\(summary.size) questions")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if summary.attemptCount > 0 {
                Text("Best \(summary.bestScore ?? 0)/\(summary.size) · \(summary.attemptCount) attempt\(summary.attemptCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Not attempted")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

/// Loads a past quiz by id and hands it to the runner for a retake.
private struct RetakeView: View {
    let quizId: String
    let model: ClassroomDetailModel

    @State private var quiz: Quiz?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let quiz {
                QuizRunnerView(quiz: quiz)
            } else if let errorMessage {
                ContentUnavailableView(
                    "Quiz unavailable",
                    systemImage: "exclamationmark.triangle",
                    description: Text(errorMessage)
                )
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Quiz")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do {
                quiz = try await model.loadQuiz(id: quizId)
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = "Could not load this quiz."
            }
        }
    }
}

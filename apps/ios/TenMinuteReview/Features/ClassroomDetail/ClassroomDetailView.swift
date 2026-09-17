import SwiftUI

struct ClassroomDetailView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
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
                        Section {
                            TodayQuizCardView(model: model)
                                .editorialSurface()
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        } header: {
                            Text("Today").eyebrowStyle(theme.colors)
                        }
                        Section {
                            BankCountsView(bank: model.bank)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        } header: {
                            Text("Question bank").eyebrowStyle(theme.colors)
                        }
                        Section {
                            if model.uploads.isEmpty {
                                Text("Add your first note to start building the bank.")
                                    .font(AppFont.geist(13))
                                    .foregroundStyle(theme.colors.mutedForeground)
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                            } else {
                                ForEach(model.uploads) { upload in
                                    NotesTimelineRow(upload: upload)
                                        .listRowBackground(Color.clear)
                                        .listRowSeparator(.hidden)
                                }
                            }
                        } header: {
                            Text("Notes").eyebrowStyle(theme.colors)
                        }
                        Section {
                            if model.quizzes.isEmpty {
                                Text("No quizzes yet.")
                                    .font(AppFont.geist(13))
                                    .foregroundStyle(theme.colors.mutedForeground)
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                            } else {
                                ForEach(model.quizzes) { summary in
                                    NavigationLink {
                                        RetakeView(quizId: summary.id, model: model)
                                    } label: {
                                        QuizListRow(summary: summary)
                                    }
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                                }
                            }
                        } header: {
                            Text("Quizzes").eyebrowStyle(theme.colors)
                        }
                    }
                    .paperScreen()
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
    @Environment(ThemeStore.self) private var theme
    let summary: QuizSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(DateFormatting.quizDateLabel(summary.quizDate))
                    .font(AppFont.geist(15, .semibold))
                    .foregroundStyle(theme.colors.foreground)
                if summary.kind == "manual" {
                    Text("On demand")
                        .font(AppFont.geist(11, .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(theme.colors.secondary, in: Capsule())
                        .foregroundStyle(theme.colors.secondaryForeground)
                }
                Spacer()
                Text("\(summary.size) questions")
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
            if summary.attemptCount > 0 {
                Text("Best \(summary.bestScore ?? 0)/\(summary.size) · \(summary.attemptCount) attempt\(summary.attemptCount == 1 ? "" : "s")")
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
            } else {
                Text("Not attempted")
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
        }
        .padding(.vertical, 4)
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

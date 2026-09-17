import SwiftUI

struct ClassroomDetailView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(ThemeStore.self) private var theme
    @Environment(\.dismiss) private var dismiss
    @State private var model: ClassroomDetailModel?
    @State private var showsAddNotes = false
    @State private var showsSettings = false
    @State private var quizPendingDelete: QuizSummary?
    let classroom: Classroom

    var body: some View {
        Group {
            if let model {
                switch model.state {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                case .failed(let message):
                    ContentUnavailableView {
                        Label(L10n.t("classrooms.unavailable"), systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(message)
                    } actions: {
                        Button(L10n.t("classrooms.retry")) { Task { await model.loadAll() } }
                    }
                case .ready:
                    List {
                        Section {
                            TodayQuizCardView(model: model)
                                .editorialSurface()
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        } header: {
                            Text(L10n.t("detail.today")).eyebrowStyle(theme.colors)
                        }
                        Section {
                            BankCountsView(bank: model.bank)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        } header: {
                            Text(L10n.t("detail.bank")).eyebrowStyle(theme.colors)
                        }
                        Section {
                            if model.uploads.isEmpty {
                                Text(L10n.t("detail.notes.empty"))
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
                            Text(L10n.t("detail.notes")).eyebrowStyle(theme.colors)
                        }
                        Section {
                            if model.quizzes.isEmpty {
                                Text(L10n.t("detail.quizzes.empty"))
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
                                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                        Button(role: .destructive) {
                                            quizPendingDelete = summary
                                        } label: {
                                            Label(L10n.t("quiz.delete"), systemImage: "trash")
                                        }
                                    }
                                    .contextMenu {
                                        Button(role: .destructive) {
                                            quizPendingDelete = summary
                                        } label: {
                                            Label(L10n.t("quiz.delete"), systemImage: "trash")
                                        }
                                    }
                                }
                            }
                        } header: {
                            Text(L10n.t("detail.quizzes")).eyebrowStyle(theme.colors)
                        }
                    }
                    .paperScreen()
                    .refreshable { await model.loadAll() }
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(model?.classroom.name ?? classroom.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        showsAddNotes = true
                    } label: {
                        Label(L10n.t("detail.notes.add"), systemImage: "plus.square")
                    }
                    if model != nil {
                        Button {
                            showsSettings = true
                        } label: {
                            Label(L10n.t("detail.settings"), systemImage: "slider.horizontal.3")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel(Text(L10n.t("detail.settings")))
            }
        }
        .navigationDestination(isPresented: $showsSettings) {
            if let model {
                ClassroomSettingsView(model: model) { dismiss() }
            }
        }
        .sheet(isPresented: $showsAddNotes) {
            if let model {
                AddNotesView(model: model)
            }
        }
        .confirmationDialog(
            L10n.t("quiz.deleteConfirm.title"),
            isPresented: Binding(
                get: { quizPendingDelete != nil },
                set: { if !$0 { quizPendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button(L10n.t("quiz.deleteConfirm.action"), role: .destructive) {
                if let quiz = quizPendingDelete {
                    Task { try? await model?.deleteQuiz(id: quiz.id) }
                }
                quizPendingDelete = nil
            }
        } message: {
            Text(L10n.t("quiz.deleteConfirm.body"))
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

struct QuizListRow: View {
    @Environment(ThemeStore.self) private var theme
    let summary: QuizSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(DateFormatting.quizDateLabel(summary.quizDate))
                    .font(AppFont.geist(15, .semibold))
                    .foregroundStyle(theme.colors.foreground)
                if summary.kind == "manual" {
                    Text(L10n.t("detail.quizzes.onDemand"))
                        .font(AppFont.geist(11, .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(theme.colors.secondary, in: Capsule())
                        .foregroundStyle(theme.colors.secondaryForeground)
                }
                Spacer()
                Text(String(format: L10n.t("detail.quizzes.questions"), summary.size))
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
            if summary.attemptCount > 0 {
                Text(String(
                    format: L10n.t("detail.quizzes.best"),
                    summary.bestScore ?? 0,
                    summary.size,
                    summary.attemptCount
                ))
                .font(AppFont.geist(12))
                .foregroundStyle(theme.colors.mutedForeground)
            } else {
                Text(L10n.t("detail.quizzes.notAttempted"))
                    .font(AppFont.geist(12))
                    .foregroundStyle(theme.colors.mutedForeground)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Loads a past quiz by id and hands it to the runner for a retake.
struct RetakeView: View {
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
                    L10n.t("classrooms.unavailable"),
                    systemImage: "exclamationmark.triangle",
                    description: Text(errorMessage)
                )
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(L10n.t("quiz.title"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do {
                quiz = try await model.loadQuiz(id: quizId)
            } catch let error as APIError {
                errorMessage = error.message
            } catch {
                errorMessage = L10n.t("quiz.wentWrong")
            }
        }
    }
}

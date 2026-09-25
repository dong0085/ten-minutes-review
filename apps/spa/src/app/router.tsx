import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { ClassroomName, Label, PointName, QuizName, UploadName } from "@/components/crumbs";
import type { CrumbHandle } from "@/components/breadcrumbs";
import { AppShell, FocusShell } from "./shell";
import { RouteError } from "@/routes/errors";
import { NotFoundPage } from "@/routes/not-found";
import { LegacyAttemptRedirect, LegacyRedirect } from "@/routes/legacy";

// Each screen loads on first visit, so the first paint only carries the shell.
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  return async () => ({ Component: (await load())[name] as ComponentType });
}

const accountPage = (name: keyof typeof import("@/routes/account-pages")) =>
  page(() => import("@/routes/account-pages"), name);

const screens = {
  classroomList: page(() => import("@/routes/classroom-list"), "ClassroomListPage"),
  newClassroom: page(() => import("@/routes/classroom-new"), "NewClassroomPage"),
  classroomLayout: page(() => import("@/routes/classroom-layout"), "ClassroomLayout"),
  hub: page(() => import("@/routes/classroom-hub"), "ClassroomHubPage"),
  notes: page(() => import("@/routes/notes"), "NotesPage"),
  addNotes: page(() => import("@/routes/notes-new"), "AddNotesPage"),
  note: page(() => import("@/routes/note-detail"), "NoteDetailPage"),
  bank: page(() => import("@/routes/bank"), "BankPage"),
  point: page(() => import("@/routes/bank-point"), "PointDetailPage"),
  quizzes: page(() => import("@/routes/quizzes"), "QuizzesPage"),
  quiz: page(() => import("@/routes/quiz-detail"), "QuizDetailPage"),
  takeQuiz: page(() => import("@/routes/quiz-take"), "TakeQuizPage"),
  attempt: page(() => import("@/routes/attempt"), "AttemptPage"),
  classroomSettings: page(() => import("@/routes/classroom-settings"), "ClassroomSettingsPage"),
  accountHub: page(() => import("@/routes/account-hub"), "AccountHubPage"),
};

const crumb = (fn: CrumbHandle["crumb"]): CrumbHandle => ({ crumb: fn });
const label = (k: Parameters<typeof Label>[0]["k"]) => crumb(() => <Label k={k} />);

const classroomChildren: RouteObject[] = [
  { index: true, lazy: screens.hub },
  {
    path: "notes",
    handle: label("notes"),
    children: [
      { index: true, lazy: screens.notes },
      { path: "new", handle: label("addNotes"), lazy: screens.addNotes },
      {
        path: ":uploadId",
        handle: crumb((p) => <UploadName classroomId={p.id!} uploadId={p.uploadId!} />),
        lazy: screens.note,
      },
    ],
  },
  {
    path: "bank",
    handle: label("bank"),
    children: [
      { index: true, lazy: screens.bank },
      {
        path: ":pointId",
        handle: crumb((p) => <PointName classroomId={p.id!} pointId={p.pointId!} />),
        lazy: screens.point,
      },
    ],
  },
  {
    path: "quizzes",
    handle: label("quizzes"),
    children: [
      { index: true, lazy: screens.quizzes },
      {
        path: ":quizId",
        handle: crumb((p) => <QuizName quizId={p.quizId!} />),
        children: [
          { index: true, lazy: screens.quiz },
          { path: "attempts/:attemptId", handle: label("attempt"), lazy: screens.attempt },
        ],
      },
    ],
  },
  { path: "settings", handle: label("settings"), lazy: screens.classroomSettings },
  // Addresses from before the drill-down layout; morning emails still link to /quiz/:quizId.
  { path: "quiz/:quizId", element: <LegacyRedirect to="quizzes/:quizId/take" /> },
  { path: "upload", element: <LegacyRedirect to="notes/new" /> },
  { path: "history", element: <LegacyRedirect to="notes" /> },
  { path: "attempts/:attemptId", element: <LegacyAttemptRedirect /> },
];

const accountChildren: RouteObject[] = [
  { index: true, lazy: screens.accountHub },
  { path: "profile", handle: label("profile"), lazy: accountPage("AccountProfilePage") },
  { path: "security", handle: label("security"), lazy: accountPage("AccountSecurityPage") },
  { path: "email", handle: label("email"), lazy: accountPage("AccountEmailPage") },
  { path: "plan", handle: label("plan"), lazy: accountPage("AccountPlanPage") },
  { path: "referrals", handle: label("referrals"), lazy: accountPage("AccountReferralsPage") },
  { path: "tokens", handle: label("tokens"), lazy: accountPage("AccountTokensPage") },
  { path: "data", handle: label("data"), lazy: accountPage("AccountDataPage") },
  { path: "api-tokens", element: <Navigate to="/account/tokens" replace /> },
];

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        path: "classrooms",
        handle: label("classrooms"),
        children: [
          { index: true, lazy: screens.classroomList },
          { path: "new", handle: label("newClassroom"), lazy: screens.newClassroom },
          {
            path: ":id",
            handle: crumb((p) => <ClassroomName id={p.id!} />),
            lazy: screens.classroomLayout,
            children: classroomChildren,
          },
        ],
      },
      { path: "account", handle: label("account"), children: accountChildren },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    // The quiz runner takes the whole screen, without the top bar.
    element: <FocusShell />,
    errorElement: <RouteError />,
    children: [{ path: "classrooms/:id/quizzes/:quizId/take", lazy: screens.takeQuiz }],
  },
]);

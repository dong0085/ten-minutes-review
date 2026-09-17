import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@tmr/db";

const dbMocks = vi.hoisted(() => ({
  getClassroom: vi.fn(),
  getEmailPreferences: vi.fn(),
  getEmailSend: vi.fn(),
  getEmailSendByQuiz: vi.fn(),
  getQuizWithQuestionsForUser: vi.fn(),
  getUserById: vi.fn(),
  listDailyEmailQuizzesForUserOnDate: vi.fn(),
  recordEmailSend: vi.fn(),
}));

const emailMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  renderDailyQuizEmail: vi.fn(),
}));

vi.mock("@tmr/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tmr/db")>()),
  ...dbMocks,
}));

vi.mock("../email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../email")>()),
  sendEmail: emailMocks.sendEmail,
  renderDailyQuizEmail: emailMocks.renderDailyQuizEmail,
}));

vi.mock("../env", () => ({
  env: { appUrl: "https://example.test", authSecret: "test-secret" },
}));

import { handleSendEmailJob } from "./send-email";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getEmailPreferences.mockResolvedValue({
    dailyEnabled: true,
    unsubscribedAt: null,
  });
  dbMocks.getEmailSend.mockResolvedValue(null);
  dbMocks.getEmailSendByQuiz.mockResolvedValue(null);
  dbMocks.getUserById.mockResolvedValue({
    id: "user-1",
    email: "learner@example.test",
    username: "Learner",
    uiLanguage: "en",
  });
  emailMocks.renderDailyQuizEmail.mockResolvedValue({
    subject: "Today's quiz",
    html: "<html></html>",
    text: "Today's quiz",
  });
  emailMocks.sendEmail.mockResolvedValue({ id: "message-1" });
  dbMocks.recordEmailSend.mockResolvedValue({ id: "send-1" });
});

function capturedEntries() {
  expect(emailMocks.renderDailyQuizEmail).toHaveBeenCalledOnce();
  const [input] = emailMocks.renderDailyQuizEmail.mock.calls[0] ?? [];
  if (!input) {
    throw new Error("renderDailyQuizEmail was called without input");
  }
  return input.entries;
}

describe("include answers in quiz emails", () => {
  it("includes answers per classroom in the daily digest", async () => {
    const db = {} as Db;
    dbMocks.listDailyEmailQuizzesForUserOnDate.mockResolvedValue([
      {
        classroomName: "French",
        quiz: { id: "quiz-1", classroomId: "classroom-1", kind: "daily" },
        includeAnswers: true,
      },
      {
        classroomName: "Spanish",
        quiz: { id: "quiz-2", classroomId: "classroom-2", kind: "daily" },
        includeAnswers: false,
      },
    ]);
    dbMocks.getQuizWithQuestionsForUser.mockImplementation(async (_db, _userId, quizId) => {
      if (quizId === "quiz-1") {
        return {
          quiz: { id: "quiz-1", classroomId: "classroom-1", kind: "daily" },
          questions: [
            {
              position: 0,
              category: "vocabulary",
              type: "mcq",
              stem: "French question",
              options: ["A", "B"],
              answer: { index: 1 },
              explanation: "French explanation",
            },
          ],
        };
      }
      return {
        quiz: { id: "quiz-2", classroomId: "classroom-2", kind: "daily" },
        questions: [
          {
            position: 0,
            category: "grammar",
            type: "true_false",
            stem: "Spanish question",
            options: null,
            answer: { value: true },
            explanation: "Spanish explanation",
          },
        ],
      };
    });

    await handleSendEmailJob(db, {
      userId: "user-1",
      quizDate: "2026-09-16",
      kind: "daily",
      sendAt: "2026-09-16T11:00:00.000Z",
    });

    const entries = capturedEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ classroomName: "French", includeAnswers: true });
    expect(entries[0].questions[0]).toMatchObject({
      answer: { index: 1 },
      explanation: "French explanation",
    });
    expect(entries[1]).toMatchObject({ classroomName: "Spanish", includeAnswers: false });
    expect(entries[1].questions[0]).not.toHaveProperty("answer");
    expect(entries[1].questions[0]).not.toHaveProperty("explanation");
  });

  it("omits answer data entirely when the setting is off", async () => {
    const db = {} as Db;
    dbMocks.listDailyEmailQuizzesForUserOnDate.mockResolvedValue([
      {
        classroomName: "French",
        quiz: { id: "quiz-1", classroomId: "classroom-1", kind: "daily" },
        includeAnswers: false,
      },
    ]);
    dbMocks.getQuizWithQuestionsForUser.mockResolvedValue({
      quiz: { id: "quiz-1", classroomId: "classroom-1", kind: "daily" },
      questions: [
        {
          position: 0,
          category: "vocabulary",
          type: "mcq",
          stem: "A question",
          options: ["A", "B"],
          answer: { index: 0 },
          explanation: "An explanation",
        },
      ],
    });

    await handleSendEmailJob(db, {
      userId: "user-1",
      quizDate: "2026-09-16",
      kind: "daily",
      sendAt: "2026-09-16T11:00:00.000Z",
    });

    const entries = capturedEntries();
    expect(entries[0].includeAnswers).toBe(false);
    expect(entries[0].questions[0]).not.toHaveProperty("answer");
    expect(entries[0].questions[0]).not.toHaveProperty("explanation");
  });

  it("honours the classroom setting for manual quiz emails", async () => {
    const db = {} as Db;
    dbMocks.getQuizWithQuestionsForUser.mockResolvedValue({
      quiz: { id: "quiz-m", classroomId: "classroom-m", kind: "manual" },
      questions: [
        {
          position: 0,
          category: "vocabulary",
          type: "fill_blank",
          stem: "A manual question",
          options: null,
          answer: { blanks: ["réponse"] },
          explanation: "A manual explanation",
        },
      ],
    });
    dbMocks.getClassroom.mockResolvedValue({
      id: "classroom-m",
      name: "Manual classroom",
      includeAnswersInEmail: true,
    });

    await handleSendEmailJob(db, {
      userId: "user-1",
      quizDate: "2026-09-16",
      kind: "manual",
      quizId: "quiz-m",
    });

    const entries = capturedEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      classroomName: "Manual classroom",
      includeAnswers: true,
    });
    expect(entries[0].questions[0]).toMatchObject({
      answer: { blanks: ["réponse"] },
      explanation: "A manual explanation",
    });
  });
});

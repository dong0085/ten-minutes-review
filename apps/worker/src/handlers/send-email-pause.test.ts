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

const emailMocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@tmr/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tmr/db")>()),
  ...dbMocks,
}));

vi.mock("../email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../email")>()),
  sendEmail: emailMocks.sendEmail,
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
  dbMocks.getUserById.mockResolvedValue({
    id: "user-1",
    email: "learner@example.test",
    username: "Learner",
    uiLanguage: "en",
  });
  dbMocks.listDailyEmailQuizzesForUserOnDate.mockResolvedValue([
    {
      classroomName: "Active classroom",
      quiz: { id: "quiz-active", classroomId: "classroom-active", kind: "daily" },
    },
  ]);
  dbMocks.getQuizWithQuestionsForUser.mockResolvedValue({
    quiz: { id: "quiz-active", classroomId: "classroom-active", kind: "daily" },
    questions: [
      {
        position: 0,
        category: "vocabulary",
        type: "mcq",
        stem: "A question",
        options: ["A", "B"],
      },
    ],
  });
  emailMocks.sendEmail.mockResolvedValue({ id: "message-1" });
  dbMocks.recordEmailSend.mockResolvedValue({ id: "send-1" });
});

describe("consolidated daily email pause filtering", () => {
  it("sends the remaining active classroom after paused classrooms are excluded", async () => {
    const db = {} as Db;
    await handleSendEmailJob(db, {
      userId: "user-1",
      quizDate: "2026-09-15",
      kind: "daily",
      sendAt: "2026-09-15T11:00:00.000Z",
    });

    expect(dbMocks.listDailyEmailQuizzesForUserOnDate).toHaveBeenCalledWith(
      db,
      "user-1",
      "2026-09-15",
      new Date("2026-09-15T11:00:00.000Z"),
    );
    expect(emailMocks.sendEmail).toHaveBeenCalledOnce();
    expect(dbMocks.recordEmailSend).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ classroomIds: ["classroom-active"] }),
    );
    expect(dbMocks.getQuizWithQuestionsForUser).toHaveBeenCalledTimes(1);
  });
});

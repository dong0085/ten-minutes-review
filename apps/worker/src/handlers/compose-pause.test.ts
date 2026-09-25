import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@tmr/db";

const dbMocks = vi.hoisted(() => ({
  createQuizWithQuestions: vi.fn(),
  enqueueJob: vi.fn(),
  getClassroom: vi.fn(),
  getDailyQuizByClassroomAndDate: vi.fn(),
  getJobById: vi.fn(),
  hasDeletedDailyQuiz: vi.fn(),
  listKnowledgePointsForComposition: vi.fn(),
  listLastQuizzedByPoint: vi.fn(),
  listRecentMisses: vi.fn(),
  listWeekQuestionStems: vi.fn(),
  markJobCancelled: vi.fn(),
}));

const llmMocks = vi.hoisted(() => ({ compose: vi.fn() }));

vi.mock("@tmr/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tmr/db")>()),
  ...dbMocks,
}));

vi.mock("../llm", () => ({
  getLlmProvider: () => ({ compose: llmMocks.compose }),
}));

import { handleComposeJob } from "./compose";

const activeClassroom = {
  id: "classroom-1",
  targetLanguage: "fr",
  nativeLanguage: "en",
  pausedAt: null,
  dailyResumedAt: null,
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
};

const bank = [
  {
    id: "point-1",
    category: "vocabulary",
    targetText: "bonjour",
    nativeText: "hello",
    detail: null,
    createdAt: new Date("2026-09-20T12:00:00.000Z"),
  },
];

const questions = Array.from({ length: 5 }, (_, index) => ({
  knowledge_point_id: "point-1",
  category: "vocabulary",
  type: "mcq",
  stem: `Question ${index + 1}`,
  options: ["bonjour", "au revoir"],
  answer: { index: 0 },
  explanation: "Bonjour means hello.",
}));

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getDailyQuizByClassroomAndDate.mockResolvedValue(null);
  dbMocks.hasDeletedDailyQuiz.mockResolvedValue(false);
  dbMocks.getJobById.mockResolvedValue({ status: "running", payload: {} });
  dbMocks.listKnowledgePointsForComposition.mockResolvedValue(bank);
  dbMocks.listLastQuizzedByPoint.mockResolvedValue(new Map());
  dbMocks.listRecentMisses.mockResolvedValue([]);
  dbMocks.listWeekQuestionStems.mockResolvedValue([]);
  llmMocks.compose.mockResolvedValue({ quiz_date: "2026-09-15", questions });
});

describe("daily compose pause race", () => {
  it("does not save an in-flight daily quiz when the classroom is paused", async () => {
    dbMocks.getClassroom
      .mockResolvedValueOnce(activeClassroom)
      .mockResolvedValueOnce({
        ...activeClassroom,
        pausedAt: new Date("2026-09-15T11:02:00.000Z"),
      });

    await handleComposeJob(
      {} as Db,
      {
        classroomId: "classroom-1",
        userId: "user-1",
        localDate: "2026-09-15",
        source: "daily",
        sendAt: "2026-09-15T11:00:00.000Z",
      },
      "job-1",
    );

    expect(llmMocks.compose).toHaveBeenCalledOnce();
    expect(dbMocks.createQuizWithQuestions).not.toHaveBeenCalled();
    expect(dbMocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("still saves and emails a manual quiz while the classroom is paused", async () => {
    dbMocks.getClassroom.mockResolvedValue({
      ...activeClassroom,
      pausedAt: new Date("2026-09-15T11:02:00.000Z"),
    });
    dbMocks.createQuizWithQuestions.mockResolvedValue({
      quiz: { id: "quiz-manual" },
      created: true,
      blocked: false,
    });

    await handleComposeJob({} as Db, {
      classroomId: "classroom-1",
      userId: "user-1",
      localDate: "2026-09-15",
      source: "manual",
    });

    expect(dbMocks.createQuizWithQuestions).toHaveBeenCalledWith(
      {} as Db,
      expect.objectContaining({ kind: "manual", dailySendAt: undefined }),
    );
    expect(dbMocks.enqueueJob).toHaveBeenCalledWith(
      {} as Db,
      expect.objectContaining({
        kind: "send_email",
        payload: expect.objectContaining({ kind: "manual", quizId: "quiz-manual" }),
      }),
    );
  });
});

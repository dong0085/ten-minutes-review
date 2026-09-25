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
  listRecentMisses: vi.fn(),
  listWeekQuestionStems: vi.fn(),
  markJobCancelled: vi.fn(),
  recordJobResult: vi.fn(),
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
  dbMocks.getJobById.mockResolvedValue({ id: "job-1", status: "running", payload: {} });
  dbMocks.getClassroom.mockResolvedValue({
    id: "classroom-1",
    targetLanguage: "fr",
    nativeLanguage: "en",
    pausedAt: null,
    dailyResumedAt: null,
    createdAt: new Date("2026-09-01T12:00:00.000Z"),
  });
  dbMocks.getDailyQuizByClassroomAndDate.mockResolvedValue(null);
  dbMocks.hasDeletedDailyQuiz.mockResolvedValue(false);
  dbMocks.listKnowledgePointsForComposition.mockResolvedValue([
    { id: "point-1", category: "vocabulary", targetText: "bonjour", nativeText: "hello", detail: null },
  ]);
  dbMocks.listRecentMisses.mockResolvedValue([]);
  dbMocks.listWeekQuestionStems.mockResolvedValue([]);
  dbMocks.createQuizWithQuestions.mockResolvedValue({
    quiz: { id: "quiz-7" },
    created: true,
    blocked: false,
  });
  llmMocks.compose.mockResolvedValue({ quiz_date: "2026-09-25", questions });
});

describe("compose job result", () => {
  it("records the on-demand quiz on its job so the requester can open it", async () => {
    await handleComposeJob(
      {} as Db,
      { classroomId: "classroom-1", userId: "user-1", localDate: "2026-09-25", source: "manual" },
      "job-1",
    );

    expect(dbMocks.recordJobResult).toHaveBeenCalledWith(expect.anything(), "job-1", {
      quizId: "quiz-7",
    });
  });

  it("leaves daily compose jobs without a recorded quiz", async () => {
    await handleComposeJob(
      {} as Db,
      { classroomId: "classroom-1", userId: "user-1", localDate: "2026-09-25", source: "daily", sendAt: "2026-09-25T11:00:00.000Z" },
      "job-1",
    );

    expect(dbMocks.createQuizWithQuestions).toHaveBeenCalled();
    expect(dbMocks.recordJobResult).not.toHaveBeenCalled();
  });
});

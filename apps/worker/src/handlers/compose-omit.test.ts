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

const classroom = {
  id: "classroom-1",
  targetLanguage: "fr",
  nativeLanguage: "en",
  pausedAt: null,
  dailyResumedAt: null,
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
};

const activePoint = {
  id: "point-1",
  category: "vocabulary",
  targetText: "bonjour",
  nativeText: "hello",
  detail: null,
  createdAt: new Date("2026-09-20T12:00:00.000Z"),
};

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
  dbMocks.getClassroom.mockResolvedValue(classroom);
  dbMocks.getDailyQuizByClassroomAndDate.mockResolvedValue(null);
  dbMocks.hasDeletedDailyQuiz.mockResolvedValue(false);
  dbMocks.listLastQuizzedByPoint.mockResolvedValue(new Map());
  dbMocks.listRecentMisses.mockResolvedValue([]);
  dbMocks.listWeekQuestionStems.mockResolvedValue([]);
  dbMocks.createQuizWithQuestions.mockResolvedValue({
    quiz: { id: "quiz-1" },
    created: true,
    blocked: false,
  });
  llmMocks.compose.mockResolvedValue({ quiz_date: "2026-09-15", questions });
});

describe("compose job with omitted knowledge points", () => {
  it("skips composition when all knowledge points are omitted from the bank", async () => {
    dbMocks.listKnowledgePointsForComposition.mockResolvedValue([]);

    await handleComposeJob(
      {} as Db,
      {
        userId: "user-1",
        classroomId: classroom.id,
        localDate: "2026-09-15",
        kind: "manual",
      },
      "job-1",
    );

    expect(llmMocks.compose).not.toHaveBeenCalled();
    expect(dbMocks.createQuizWithQuestions).not.toHaveBeenCalled();
  });

  it("passes only unretired knowledge points to LLM composition", async () => {
    dbMocks.listKnowledgePointsForComposition.mockResolvedValue([activePoint]);

    await handleComposeJob(
      {} as Db,
      {
        userId: "user-1",
        classroomId: classroom.id,
        localDate: "2026-09-15",
        kind: "manual",
      },
      "job-2",
    );

    expect(llmMocks.compose).toHaveBeenCalledTimes(1);
    const callArgs = llmMocks.compose.mock.calls[0]?.[0] as {
      payload: { knowledgePoints: { id: string }[] };
    };
    expect(callArgs.payload.knowledgePoints).toEqual([
      {
        id: "point-1",
        category: "vocabulary",
        target: "bonjour",
        native: "hello",
        detail: null,
      },
    ]);
  });
});

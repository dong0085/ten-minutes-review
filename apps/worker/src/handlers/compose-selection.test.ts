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

const DAY_MS = 24 * 60 * 60 * 1000;
const bank = Array.from({ length: 40 }, (_, index) => ({
  id: `point-${index}`,
  category: "phrase",
  targetText: `mot ${index}`,
  nativeText: `word ${index}`,
  detail: null,
  createdAt: new Date(Date.now() - (30 + index) * DAY_MS),
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
  dbMocks.listKnowledgePointsForComposition.mockResolvedValue(bank);
  dbMocks.listLastQuizzedByPoint.mockResolvedValue(new Map());
  dbMocks.listRecentMisses.mockResolvedValue([
    { knowledgePointId: "point-39", stem: "Missed question" },
  ]);
  dbMocks.listWeekQuestionStems.mockResolvedValue([]);
  dbMocks.createQuizWithQuestions.mockResolvedValue({
    quiz: { id: "quiz-7" },
    created: true,
    blocked: false,
  });
  llmMocks.compose.mockImplementation(
    async ({ payload }: { payload: { knowledgePoints: { id: string }[] } }) => ({
      quiz_date: "2026-09-25",
      questions: payload.knowledgePoints.map((point) => ({
        knowledge_point_id: point.id,
        category: "vocabulary",
        type: "mcq",
        stem: `Question on ${point.id}`,
        options: ["oui", "non"],
        answer: { index: 0 },
        explanation: "Because.",
      })),
    }),
  );
});

describe("compose point selection", () => {
  it("sends only the chosen points, misses first, and saves a full quiz", async () => {
    await handleComposeJob(
      {} as Db,
      { classroomId: "classroom-1", userId: "user-1", localDate: "2026-09-25", source: "manual" },
      "job-1",
    );

    const { payload } = llmMocks.compose.mock.calls[0]?.[0] as {
      payload: {
        size: number;
        knowledgePoints: { id: string }[];
        recentMisses: { knowledgePointId: string }[];
      };
    };
    expect(payload.size).toBe(8);
    expect(payload.knowledgePoints).toHaveLength(11);
    expect(payload.knowledgePoints[0]?.id).toBe("point-39");
    expect(payload.recentMisses).toEqual([
      { knowledgePointId: "point-39", stem: "Missed question" },
    ]);

    const saved = dbMocks.createQuizWithQuestions.mock.calls[0]?.[1] as {
      questions: { knowledgePointId: string; position: number }[];
    };
    const sentIds = payload.knowledgePoints.slice(0, 8).map((point) => point.id);
    expect(saved.questions.map((question) => question.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(saved.questions.map((question) => question.knowledgePointId).sort()).toEqual(
      [...sentIds].sort(),
    );
  });

  it("fits twice as many vocabulary questions into the same budget", async () => {
    dbMocks.listKnowledgePointsForComposition.mockResolvedValue(
      bank.map((point) => ({ ...point, category: "vocabulary" })),
    );

    await handleComposeJob(
      {} as Db,
      { classroomId: "classroom-1", userId: "user-1", localDate: "2026-09-25", source: "manual" },
      "job-1",
    );

    const { payload } = llmMocks.compose.mock.calls[0]?.[0] as {
      payload: { size: number; knowledgePoints: { id: string }[] };
    };
    expect(payload.size).toBe(16);
    expect(payload.knowledgePoints).toHaveLength(19);
    const saved = dbMocks.createQuizWithQuestions.mock.calls[0]?.[1] as {
      size: number;
      questions: unknown[];
    };
    expect(saved.size).toBe(16);
    expect(saved.questions).toHaveLength(16);
  });

  it("scales the budget by the classroom's quiz length", async () => {
    dbMocks.getClassroom.mockResolvedValue({
      id: "classroom-1",
      targetLanguage: "fr",
      nativeLanguage: "en",
      quizLength: 2,
      pausedAt: null,
      dailyResumedAt: null,
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
    });

    await handleComposeJob(
      {} as Db,
      { classroomId: "classroom-1", userId: "user-1", localDate: "2026-09-25", source: "manual" },
      "job-1",
    );

    const saved = dbMocks.createQuizWithQuestions.mock.calls[0]?.[1] as { size: number };
    expect(saved.size).toBe(16);
  });
});

describe("exam composition", () => {
  const examBank = Array.from({ length: 90 }, (_, index) => ({
    id: `point-${index}`,
    category: (["vocabulary", "grammar", "phrase"] as const)[index % 3],
    targetText: `mot ${index}`,
    nativeText: `word ${index}`,
    detail: null,
    createdAt: new Date(Date.now() - (30 + index) * DAY_MS),
  }));

  beforeEach(() => {
    dbMocks.listKnowledgePointsForComposition.mockResolvedValue(examBank);
    llmMocks.compose.mockImplementation(
      async ({ payload }: { payload: { knowledgePoints: { id: string; type: string }[] } }) => ({
        quiz_date: "2026-09-25",
        questions: payload.knowledgePoints.map((point) => ({
          knowledge_point_id: point.id,
          category: "vocabulary",
          type: point.type,
          stem: `Question on ${point.id}`,
          options: point.type === "mcq" ? ["a", "b", "c", "d"] : null,
          answer:
            point.type === "mcq"
              ? { index: 0 }
              : point.type === "true_false"
                ? { value: true }
                : { blanks: ["x"] },
          explanation: "Because.",
        })),
      }),
    );
  });

  it("saves a 40-question paper in part order and sends no email", async () => {
    await handleComposeJob(
      {} as Db,
      { classroomId: "classroom-1", userId: "user-1", localDate: "2026-09-25", source: "exam" },
      "job-1",
    );

    const { systemPrompt, payload } = llmMocks.compose.mock.calls[0]?.[0] as {
      systemPrompt: string;
      payload: { knowledgePoints: { type: string }[] };
    };
    expect(systemPrompt).toContain("You write an exam");
    expect(payload.knowledgePoints).toHaveLength(52);

    const saved = dbMocks.createQuizWithQuestions.mock.calls[0]?.[1] as {
      kind: string;
      size: number;
      questions: { type: string; position: number }[];
    };
    expect(saved.kind).toBe("exam");
    expect(saved.size).toBe(40);
    expect(saved.questions.slice(0, 20).every((question) => question.type === "mcq")).toBe(true);
    expect(saved.questions.slice(20, 30).every((question) => question.type === "true_false")).toBe(true);
    expect(saved.questions.slice(30).every((question) => question.type === "fill_blank")).toBe(true);
    expect(saved.questions.map((question) => question.position)).toEqual(
      Array.from({ length: 40 }, (_, index) => index),
    );
    expect(dbMocks.recordJobResult).toHaveBeenCalledWith({}, "job-1", { quizId: "quiz-7" });
    expect(dbMocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("fails the job when the model changes too many question types", async () => {
    llmMocks.compose.mockImplementation(
      async ({ payload }: { payload: { knowledgePoints: { id: string }[] } }) => ({
        quiz_date: "2026-09-25",
        questions: payload.knowledgePoints.map((point) => ({
          knowledge_point_id: point.id,
          category: "vocabulary",
          type: "mcq",
          stem: `Question on ${point.id}`,
          options: ["a", "b"],
          answer: { index: 0 },
          explanation: "Because.",
        })),
      }),
    );
    await expect(
      handleComposeJob(
        {} as Db,
        { classroomId: "classroom-1", userId: "user-1", localDate: "2026-09-25", source: "exam" },
        "job-1",
      ),
    ).rejects.toThrow("exam blueprint not filled");
    expect(dbMocks.createQuizWithQuestions).not.toHaveBeenCalled();
  });
});

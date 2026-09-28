import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@tmr/db";

const dbMocks = vi.hoisted(() => ({
  getExamReviewInput: vi.fn(),
  saveAttemptReview: vi.fn(),
}));

const llmMocks = vi.hoisted(() => ({ summarize: vi.fn() }));

vi.mock("@tmr/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tmr/db")>()),
  ...dbMocks,
}));

vi.mock("../llm", () => ({
  getLlmProvider: () => ({ summarize: llmMocks.summarize }),
}));

import { describeResponse, handleSummarizeJob } from "./summarize";

function answer(position: number, type: string, isCorrect: boolean, extra: object = {}) {
  return {
    questionId: `q-${position}`,
    position,
    category: "grammar",
    type,
    stem: `Stem ${position}`,
    options: type === "mcq" ? ["va", "vont", "allons", "allez"] : null,
    answer: type === "mcq" ? { index: 1 } : type === "true_false" ? { value: true } : { blanks: ["suis"] },
    explanation: "Because.",
    response: null,
    isCorrect,
    pointTarget: "aller",
    pointNative: "to go",
    ...extra,
  };
}

const input = {
  attempt: { id: "attempt-1", review: null },
  quizKind: "exam",
  targetLanguage: "fr",
  nativeLanguage: "en",
  uiLanguage: "zh-CN",
  answers: [
    answer(0, "mcq", false, { response: { index: 0 } }),
    answer(1, "mcq", true, { response: { index: 1 } }),
    answer(2, "true_false", false, { response: { value: false } }),
    answer(3, "fill_blank", false, { response: { blanks: [""] } }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getExamReviewInput.mockResolvedValue(input);
  llmMocks.summarize.mockResolvedValue({
    overview: "Verb forms slipped.",
    patterns: [{ title: "Aller", detail: "You wrote « va ».", questions: [1, 2, 40] }],
    next_steps: ["Conjugate aller."],
  });
});

describe("summarize job", () => {
  it("sends only the misses, numbered as on the paper, and saves the review", async () => {
    await handleSummarizeJob({} as Db, { attemptId: "attempt-1" });

    const { systemPrompt, payload } = llmMocks.summarize.mock.calls[0]?.[0] as {
      systemPrompt: string;
      payload: {
        writeIn: string;
        score: { earned: number; total: number };
        misses: { number: number; learnerAnswer: string; rightAnswer: string }[];
      };
    };
    expect(systemPrompt).toContain("patterns behind their mistakes");
    expect(payload.writeIn).toBe("Simplified Chinese");
    expect(payload.score).toEqual({ earned: 2, total: 10 });
    expect(payload.misses.map((miss) => [miss.number, miss.learnerAnswer, miss.rightAnswer])).toEqual([
      [1, "va", "vont"],
      [3, "false", "true"],
      [4, "(blank)", "suis"],
    ]);

    expect(dbMocks.saveAttemptReview).toHaveBeenCalledWith(
      {},
      "attempt-1",
      {
        overview: "Verb forms slipped.",
        patterns: [{ title: "Aller", detail: "You wrote « va ».", questions: [1] }],
        nextSteps: ["Conjugate aller."],
      },
      "exam-review-v1",
    );
  });

  it("skips attempts that are not exams, already reviewed, or perfect", async () => {
    dbMocks.getExamReviewInput.mockResolvedValueOnce({ ...input, quizKind: "manual" });
    await handleSummarizeJob({} as Db, { attemptId: "attempt-1" });
    dbMocks.getExamReviewInput.mockResolvedValueOnce({
      ...input,
      attempt: { id: "attempt-1", review: { overview: "done" } },
    });
    await handleSummarizeJob({} as Db, { attemptId: "attempt-1" });
    dbMocks.getExamReviewInput.mockResolvedValueOnce({
      ...input,
      answers: input.answers.map((entry) => ({ ...entry, isCorrect: true })),
    });
    await handleSummarizeJob({} as Db, { attemptId: "attempt-1" });

    expect(llmMocks.summarize).not.toHaveBeenCalled();
    expect(dbMocks.saveAttemptReview).not.toHaveBeenCalled();
  });

  it("describes blank answers plainly", () => {
    expect(describeResponse("mcq", ["a"], null)).toBe("(blank)");
    expect(describeResponse("fill_blank", null, { blanks: ["je", null] })).toBe("je / (blank)");
  });
});

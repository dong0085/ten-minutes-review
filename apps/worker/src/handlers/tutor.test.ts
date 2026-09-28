import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@tmr/db";

const dbMocks = vi.hoisted(() => ({
  getTutorInput: vi.fn(),
  completeTutorRequest: vi.fn(),
  failTutorRequest: vi.fn(),
}));

const llmMocks = vi.hoisted(() => ({ tutor: vi.fn() }));

vi.mock("@tmr/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tmr/db")>()),
  ...dbMocks,
}));

vi.mock("../llm", () => ({
  getLlmProvider: () => ({ tutor: llmMocks.tutor }),
}));

import { handleTutorJob } from "./tutor";

function input(mode: "hint" | "analysis", extra: object = {}) {
  return {
    request: {
      id: "req-1",
      mode,
      level: mode === "hint" ? 2 : 0,
      status: "pending",
      response: mode === "analysis" ? { index: 1 } : null,
      ...extra,
    },
    question: {
      id: "q-1",
      category: "vocabulary",
      type: "mcq",
      stem: "« le boulanger » veut dire :",
      options: ["the baker", "the bakery", "the butcher", "the barber"],
      answer: { index: 0 },
      explanation: "Un boulanger fait le pain.",
    },
    pointTarget: "le boulanger",
    pointNative: "the baker",
    targetLanguage: "fr",
    nativeLanguage: "en",
    uiLanguage: "zh",
    earlierHints: ["Look at the ending."],
    missCount: 2,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tutor job", () => {
  it("asks for a hint at the request's level, with earlier hints, in the interface language", async () => {
    dbMocks.getTutorInput.mockResolvedValue(input("hint"));
    llmMocks.tutor.mockResolvedValue({ hint: "Is it a person or a place?" });

    await handleTutorJob({} as Db, { requestId: "req-1" });

    const { systemPrompt, payload } = llmMocks.tutor.mock.calls[0]?.[0] as {
      systemPrompt: string;
      payload: { level: number; earlierHints: string[]; writeIn: string; learnerAnswer?: string };
    };
    expect(systemPrompt).toContain("Never give the answer");
    expect(payload).toMatchObject({ level: 2, earlierHints: ["Look at the ending."], writeIn: "Simplified Chinese" });
    expect(payload.learnerAnswer).toBeUndefined();
    expect(dbMocks.completeTutorRequest).toHaveBeenCalledWith(
      {},
      "req-1",
      { hint: "Is it a person or a place?" },
      "tutor-v1",
    );
  });

  it("retries a hint that gives the answer away, and marks it failed on the last try", async () => {
    dbMocks.getTutorInput.mockResolvedValue(input("hint"));
    llmMocks.tutor.mockResolvedValue({ hint: "It means THE BAKER." });

    await expect(handleTutorJob({} as Db, { requestId: "req-1" }, 1)).rejects.toThrow("gave away");
    expect(dbMocks.failTutorRequest).not.toHaveBeenCalled();
    await expect(handleTutorJob({} as Db, { requestId: "req-1" }, 3)).rejects.toThrow("gave away");
    expect(dbMocks.failTutorRequest).toHaveBeenCalledWith({}, "req-1");
    expect(dbMocks.completeTutorRequest).not.toHaveBeenCalled();
  });

  it("explains a wrong answer with the learner's answer and miss count", async () => {
    dbMocks.getTutorInput.mockResolvedValue(input("analysis"));
    llmMocks.tutor.mockResolvedValue({
      diagnosis: "You picked the shop.",
      rule: "-erie is a place.",
      examples: [{ target: "la boucherie", translation: "the butcher's shop" }],
      tip: "Person or place?",
    });

    await handleTutorJob({} as Db, { requestId: "req-1" });

    const { payload } = llmMocks.tutor.mock.calls[0]?.[0] as {
      payload: { learnerAnswer: string; missCount: number; question: { rightAnswer: string } };
    };
    expect(payload).toMatchObject({ learnerAnswer: "the bakery", missCount: 2 });
    expect(payload.question.rightAnswer).toBe("the baker");
    expect(dbMocks.completeTutorRequest).toHaveBeenCalledOnce();
  });

  it("skips a request that is already answered", async () => {
    dbMocks.getTutorInput.mockResolvedValue(input("hint", { status: "done" }));
    await handleTutorJob({} as Db, { requestId: "req-1" });
    expect(llmMocks.tutor).not.toHaveBeenCalled();
  });
});

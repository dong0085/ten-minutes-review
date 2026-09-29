import { describe, expect, it, vi } from "vitest";
import type { CompositionQuestion } from "@tmr/core";
import type { JevAnswer, JevClient } from "./jev";
import type { CompositionPayload, LlmProvider } from "./llm";
import { reviewAndRewrite, reviewQuestions } from "./review";

const payload: CompositionPayload = {
  targetLanguage: "fr",
  nativeLanguage: "en",
  size: 2,
  knowledgePoints: [
    { id: "a", category: "vocabulary", target: "l'étendoir", native: "the clothes line", detail: null },
    { id: "b", category: "vocabulary", target: "le plafond", native: "the ceiling", detail: null },
  ],
  alreadyAskedStems: [],
  recentMisses: [],
};

function mcq(id: string, stem: string, explanation = "…"): CompositionQuestion {
  return {
    knowledge_point_id: id,
    category: "vocabulary",
    type: "mcq",
    stem,
    options: ["le mot", "la chose", "le truc"],
    answer: { index: 0 },
    explanation,
  };
}

const bad = mcq("a", "BAD stem");
const good = mcq("b", "Comment dit-on « the ceiling » ?");

/** Jev that rejects any question whose stem starts with BAD. */
function fakeJev(): JevClient {
  return {
    ask: vi.fn(async (state: unknown) => {
      const broken = String((state as { stem: string }).stem).startsWith("BAD");
      const answers: Record<string, JevAnswer> = {
        reveals_answer: { type: "noul", noul: broken ? 0.92 : 0.05 },
        answer_wrong: { type: "noul", noul: 0.03 },
        several_right: { type: "noul", noul: 0.04 },
        weak_distractors: { type: "noul", noul: 0.1 },
        quality: { type: "score", score: broken ? 0.8 : 3.2, confidence: 0.6 },
      };
      return answers;
    }),
  };
}

function fakeProvider(rewrite: CompositionQuestion): LlmProvider {
  return {
    extract: vi.fn(),
    summarize: vi.fn(),
    tutor: vi.fn(),
    compose: vi.fn(async () => ({ quiz_date: "2026-09-29", questions: [rewrite] })),
  };
}

describe("reviewAndRewrite", () => {
  it("keeps passing questions without asking for a rewrite", async () => {
    const provider = fakeProvider(good);
    const outcome = await reviewAndRewrite({ jev: fakeJev(), provider, payload, questions: [good] });
    expect(outcome.kept).toEqual([good]);
    expect(provider.compose).not.toHaveBeenCalled();
  });

  it("sends the rejected question and Jev's scores, and swaps in a rewrite that passes", async () => {
    const fixed = mcq("a", "Comment dit-on « the clothes line » ?");
    const provider = fakeProvider(fixed);
    const outcome = await reviewAndRewrite({ jev: fakeJev(), provider, payload, questions: [bad, good] });

    expect(outcome.kept).toEqual([fixed, good]);
    expect(outcome.stats).toMatchObject({ reviewed: 2, rewritten: 1, rescued: 1, rejected: 0 });
    const sent = vi.mocked(provider.compose).mock.calls[0]?.[0].payload as {
      items: { rejectedQuestion: CompositionQuestion; failedChecks: Record<string, number>; qualityScore: number }[];
    };
    expect(sent.items).toHaveLength(1);
    expect(sent.items[0]?.rejectedQuestion).toEqual(bad);
    expect(sent.items[0]?.failedChecks).toEqual({ reveals_answer: 0.92, low_quality: 0.8 });
    expect(sent.items[0]?.qualityScore).toBe(0.8);
  });

  it("sets aside a question whose rewrite fails again", async () => {
    const stillBad = mcq("a", "BAD again");
    const outcome = await reviewAndRewrite({
      jev: fakeJev(),
      provider: fakeProvider(stillBad),
      payload,
      questions: [bad, good],
    });
    expect(outcome.kept).toEqual([good]);
    expect(outcome.rejected.map((entry) => entry.question)).toEqual([stillBad]);
    expect(outcome.stats.rejected).toBe(1);
  });

  it("keeps questions Jev could not review", async () => {
    const jev: JevClient = { ask: vi.fn(async () => Promise.reject(new Error("529"))) };
    const outcome = await reviewAndRewrite({ jev, provider: fakeProvider(good), payload, questions: [bad, good] });
    expect(outcome.kept).toEqual([bad, good]);
    expect(outcome.stats).toMatchObject({ reviewed: 0, unreviewed: 2 });
  });
});

describe("reviewQuestions", () => {
  it("asks a true_false only about its verdict and ambiguity, not options or giveaways", () => {
    const statement: CompositionQuestion = {
      ...mcq("a", "Le verbe « partir » prend être."),
      type: "true_false",
      options: null,
      answer: { value: true },
    };
    expect(Object.keys(reviewQuestions(statement))).toEqual(["answer_wrong", "several_right", "quality"]);
    expect(Object.keys(reviewQuestions(good))).toContain("weak_distractors");
  });

  it("keeps a rewrite in the type of the question it replaces", async () => {
    const statement: CompositionQuestion = {
      ...bad,
      type: "true_false",
      options: null,
      answer: { value: true },
    };
    const wrongType = mcq("a", "Comment dit-on « the clothes line » ?");
    const outcome = await reviewAndRewrite({
      jev: fakeJev(),
      provider: fakeProvider(wrongType),
      payload,
      questions: [statement],
    });
    expect(outcome.kept).toEqual([]);
    expect(outcome.rejected.map((entry) => entry.question)).toEqual([statement]);
  });
});

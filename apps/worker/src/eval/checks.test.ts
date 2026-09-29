import { describe, expect, it } from "vitest";
import type { CompositionQuestion } from "@tmr/core";
import type { CompositionPayload } from "../llm";
import { checkCase, checkQuestion } from "./checks";

const base = { knowledge_point_id: "k", category: "vocabulary", explanation: "because" } as const;

describe("checkQuestion", () => {
  it("flags thin or repeated options", () => {
    const question: CompositionQuestion = {
      ...base,
      type: "mcq",
      stem: "Comment dit-on « the ceiling » ?",
      options: ["le plafond", "Le Plafond"],
      answer: { index: 0 },
    };
    expect(checkQuestion(question, new Set())).toEqual(["too_few_options", "duplicate_options"]);
  });

  it("flags a fill_blank whose blanks do not match its answer or that has no cue", () => {
    const question: CompositionQuestion = {
      ...base,
      type: "fill_blank",
      stem: "Je fais la ___ tous les soirs.",
      options: null,
      answer: { blanks: ["vaisselle", "extra"] },
    };
    expect(checkQuestion(question, new Set())).toEqual(["blank_count_mismatch", "no_cue"]);
  });

  it("flags a stem the learner already saw this week", () => {
    const question: CompositionQuestion = {
      ...base,
      type: "fill_blank",
      stem: "Elle se met du ___ (lipstick).",
      options: null,
      answer: { blanks: ["rouge à lèvres"] },
    };
    expect(checkQuestion(question, new Set(["elle se met du ___ (lipstick)"]))).toEqual([
      "repeats_asked_stem",
    ]);
  });
});

describe("checkCase", () => {
  it("reports dropped questions and points left without a question", () => {
    const payload: CompositionPayload = {
      targetLanguage: "fr",
      nativeLanguage: "en",
      size: 2,
      knowledgePoints: [
        { id: "k", category: "vocabulary", target: "l'étendoir", native: "the clothes line", detail: null },
        { id: "m", category: "vocabulary", target: "le plafond", native: "the ceiling", detail: null },
      ],
      alreadyAskedStems: [],
      recentMisses: [],
    };
    const check = checkCase(payload, [
      {
        ...base,
        type: "mcq",
        stem: "Quel objet est un étendoir ?",
        options: ["Un étendoir", "Un fer", "Un balai"],
        answer: { index: 0 },
      },
    ]);
    expect(check.questions[0]?.flags).toEqual(["dropped"]);
    expect(check.questions[0]?.dropReason).toBe("stem gives away the answer");
    expect(check.missingPoints).toEqual(["m"]);
    expect(check.pointCount).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  parseCompositionResult,
  parseExtractionResult,
  firstOptionNamed,
  sanitizeCompositionQuestions,
} from "./schemas";
import type { CompositionQuestion } from "../types";

describe("parseExtractionResult", () => {
  it("applies defaults for missing optional fields", () => {
    const result = parseExtractionResult({
      target_language: "fr",
      native_language: "en",
    });
    expect(result.knowledge_points).toEqual([]);
    expect(result.passages).toEqual([]);
    expect(result.discarded).toEqual([]);
    expect(result.subject).toBeNull();
  });

  it("keeps a full knowledge point", () => {
    const result = parseExtractionResult({
      subject: "Home vocabulary and emotions",
      target_language: "fr",
      native_language: "en",
      knowledge_points: [
        {
          category: "grammar",
          target_text: "adjectif → nom",
          native_text: "adjective → noun",
          grammar: {
            rule: "An adjective becomes a noun.",
            examples: [{ target: "heureux", related: "le bonheur" }],
          },
          source_excerpt: "noun et adjective différence",
        },
      ],
      discarded: [{ line: "tension au bibeau", reason: "unintelligible" }],
    });
    expect(result.knowledge_points).toHaveLength(1);
    expect(result.knowledge_points[0]?.grammar?.rule).toBe("An adjective becomes a noun.");
    expect(result.discarded[0]?.reason).toBe("unintelligible");
    expect(result.subject).toBe("Home vocabulary and emotions");
  });
});

describe("parseCompositionResult", () => {
  it("keeps questions whose answer shape matches the type", () => {
    const result = parseCompositionResult({
      quiz_date: "2026-09-10",
      questions: [
        {
          knowledge_point_id: "b1",
          category: "vocabulary",
          type: "mcq",
          stem: "« l'étendoir » veut dire :",
          options: ["the clothes line", "the ceiling"],
          answer: { index: 0 },
          explanation: "Un étendoir sèche le linge.",
        },
        {
          knowledge_point_id: "b2",
          category: "grammar",
          type: "true_false",
          stem: "« le bonheur » est un adjectif.",
          answer: { value: false },
          explanation: "C'est un nom.",
        },
      ],
    });
    expect(result.questions).toHaveLength(2);
  });

  it("drops questions whose answer shape does not match", () => {
    const result = parseCompositionResult({
      quiz_date: "2026-09-10",
      questions: [
        {
          knowledge_point_id: "b1",
          category: "vocabulary",
          type: "mcq",
          stem: "bad",
          options: ["a", "b"],
          answer: "a",
          explanation: "bad",
        },
        {
          knowledge_point_id: "b2",
          category: "grammar",
          type: "fill_blank",
          stem: "bad",
          answer: { blanks: [] },
          explanation: "bad",
        },
      ],
    });
    expect(result.questions).toEqual([]);
  });
});

describe("sanitizeCompositionQuestions", () => {
  const base: Omit<CompositionQuestion, "knowledge_point_id" | "type" | "answer" | "options"> =
    {
      category: "vocabulary",
      stem: "stem",
      explanation: "because",
    };

  it("drops unknown knowledge points", () => {
    const { kept, dropped } = sanitizeCompositionQuestions(
      [
        {
          ...base,
          knowledge_point_id: "unknown",
          type: "mcq",
          options: ["a", "b"],
          answer: { index: 0 },
        },
      ],
      new Set(["known"]),
    );
    expect(kept).toEqual([]);
    expect(dropped[0]?.reason).toBe("unknown knowledge point");
  });

  it("drops mcq questions with missing options or a bad index", () => {
    const questions: CompositionQuestion[] = [
      { ...base, knowledge_point_id: "k", type: "mcq", options: null, answer: { index: 0 } },
      { ...base, knowledge_point_id: "k", type: "mcq", options: ["a"], answer: { index: 0 } },
      { ...base, knowledge_point_id: "k", type: "mcq", options: ["a", "b"], answer: { index: 5 } },
    ];
    const { kept, dropped } = sanitizeCompositionQuestions(questions, new Set(["k"]));
    expect(kept).toEqual([]);
    expect(dropped.map((entry) => entry.reason)).toEqual([
      "missing options",
      "missing options",
      "answer index outside options",
    ]);
  });

  it("drops mcq questions whose explanation leads with a different option", () => {
    const { kept, dropped } = sanitizeCompositionQuestions(
      [
        {
          ...base,
          knowledge_point_id: "k",
          type: "mcq",
          options: ["Épuisants", "Épanouissants", "Ennuyeux", "Dangereux"],
          answer: { index: 0 },
          explanation:
            "« Épanouissants » signifie « fulfilling, enriching » ; l'option « épuisants » veut dire « exhausting ».",
        },
      ],
      new Set(["k"]),
    );
    expect(kept).toEqual([]);
    expect(dropped[0]?.reason).toBe("explanation names a different option");
  });

  it("keeps mcq questions whose explanation leads with the answer or names no option", () => {
    const { kept } = sanitizeCompositionQuestions(
      [
        {
          ...base,
          knowledge_point_id: "k",
          type: "mcq",
          options: ["Épuisants", "Épanouissants"],
          answer: { index: 1 },
          explanation: "« Épanouissants » signifie « fulfilling » ; « épuisants » veut dire « exhausting ».",
        },
        {
          ...base,
          knowledge_point_id: "k",
          type: "mcq",
          options: ["chat", "chien"],
          answer: { index: 0 },
          explanation: "Le mot désigne un félin domestique.",
        },
      ],
      new Set(["k"]),
    );
    expect(kept).toHaveLength(2);
  });

  it("keeps valid questions", () => {
    const { kept, dropped } = sanitizeCompositionQuestions(
      [
        {
          ...base,
          knowledge_point_id: "k",
          type: "mcq",
          options: ["a", "b"],
          answer: { index: 1 },
        },
        {
          ...base,
          knowledge_point_id: "k",
          type: "fill_blank",
          options: null,
          answer: { blanks: ["a"] },
        },
      ],
      new Set(["k"]),
    );
    expect(kept).toHaveLength(2);
    expect(dropped).toEqual([]);
  });
});

describe("firstOptionNamed", () => {
  it("prefers the longer option when two start at the same place", () => {
    expect(firstOptionNamed(["le", "le chat"], "« Le chat » est correct.")).toBe(1);
  });

  it("skips one-letter options", () => {
    expect(firstOptionNamed(["a", "à"], "La préposition à marque le lieu.")).toBeNull();
  });
});

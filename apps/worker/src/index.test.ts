import { describe, expect, it } from "vitest";
import {
  parseCompositionResult,
  parseExtractionResult,
  quizSize,
  sanitizeCompositionQuestions,
} from "@tmr/core";
import { createMockProvider } from "./llm";
import type { CompositionPayload } from "./llm";
import { buildEmailEntries } from "./handlers/send-email";

describe("quizSize and sanitize", () => {
  it("floors at 8 and caps at 20", () => {
    expect(quizSize(0)).toBe(0);
    expect(quizSize(1)).toBe(8);
    expect(quizSize(63)).toBe(8);
    expect(quizSize(159)).toBe(19);
    expect(quizSize(160)).toBe(20);
  });

  it("drops unknown knowledge points and invalid answer indexes", () => {
    const parsed = parseCompositionResult({
      quiz_date: "2026-09-11",
      questions: [
        {
          knowledge_point_id: "known",
          category: "vocabulary",
          type: "mcq",
          stem: "Quelle est la bonne réponse ?",
          options: ["a", "b"],
          answer: { index: 0 },
          explanation: "a",
        },
        {
          knowledge_point_id: "unknown",
          category: "vocabulary",
          type: "mcq",
          stem: "Question orpheline",
          options: ["a", "b"],
          answer: { index: 0 },
          explanation: "a",
        },
        {
          knowledge_point_id: "known",
          category: "vocabulary",
          type: "mcq",
          stem: "Index hors limites",
          options: ["a", "b"],
          answer: { index: 5 },
          explanation: "a",
        },
      ],
    });
    const { kept, dropped } = sanitizeCompositionQuestions(
      parsed.questions,
      new Set(["known"]),
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.stem).toBe("Quelle est la bonne réponse ?");
    expect(dropped).toHaveLength(2);
  });
});

describe("mock llm provider", () => {
  it("extracts a realistic fixture as a plain object", async () => {
    const provider = createMockProvider();
    const raw = await provider.extract({ systemPrompt: "x", text: "notes", targetHint: "fr" });
    expect(typeof raw).toBe("object");
    const result = parseExtractionResult(raw);
    expect(result.target_language).toBe("fr");
    expect(result.native_language).toBe("en");
    expect(result.subject).toBeTruthy();
    expect(result.passages).toHaveLength(1);

    const categories = new Set(result.knowledge_points.map((point) => point.category));
    expect(categories).toEqual(
      new Set(["vocabulary", "phrase", "grammar", "expression", "comprehension"]),
    );

    const grammar = result.knowledge_points.find((point) => point.category === "grammar");
    expect(grammar?.grammar?.rule).toBeTruthy();
    expect(grammar?.grammar?.examples.length).toBeGreaterThan(0);

    const comprehension = result.knowledge_points.find(
      (point) => point.category === "comprehension",
    );
    expect(comprehension?.passage_ref).toBe(0);
    expect(result.discarded).toHaveLength(2);
  });

  it("honours the target language hint", async () => {
    const provider = createMockProvider();
    const raw = await provider.extract({ systemPrompt: "x", text: "notes", targetHint: "es" });
    const result = parseExtractionResult(raw);
    expect(result.target_language).toBe("es");
  });

  it("composes unique questions and re-tests recent misses", async () => {
    const provider = createMockProvider();
    const extraction = parseExtractionResult(
      await provider.extract({ systemPrompt: "x", text: "notes" }),
    );
    const knowledgePoints = extraction.knowledge_points.map((point, index) => ({
      id: `kp-${index}`,
      category: point.category,
      target: point.target_text ?? "",
      native: point.native_text,
      detail:
        point.category === "grammar"
          ? { grammar: point.grammar }
          : point.category === "comprehension"
            ? { passage_ref: "passage-1" }
            : null,
    }));

    const repeatedStem = "Comment dit-on « the clothes line » en français ?";
    const payload: CompositionPayload = {
      targetLanguage: "fr",
      nativeLanguage: "en",
      size: 8,
      knowledgePoints,
      alreadyAskedStems: [repeatedStem],
      recentMisses: [{ knowledgePointId: "kp-7", stem: "ancienne formulation" }],
    };

    const raw = await provider.compose({ systemPrompt: "x", payload });
    expect(typeof raw).toBe("object");
    const result = parseCompositionResult(raw);
    expect(result.questions.length).toBeGreaterThanOrEqual(5);

    const stems = result.questions.map((question) => question.stem.toLowerCase());
    expect(stems).not.toContain(repeatedStem.toLowerCase());

    for (const question of result.questions) {
      expect(["vocabulary", "phrase", "grammar", "expression", "comprehension"]).toContain(
        question.category,
      );
      if (question.type === "mcq") {
        expect(question.options?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(question.answer).toHaveProperty("index");
      }
    }

    const retest = result.questions.find((question) =>
      question.stem.startsWith("Rappel —"),
    );
    expect(retest?.knowledge_point_id).toBe("kp-7");
  });
});

describe("send email helpers", () => {
  it("builds quiz urls and strips answers from entries", () => {
    const questions = [
      {
        position: 0,
        category: "vocabulary" as const,
        type: "mcq" as const,
        stem: "« l'étendoir » veut dire :",
        options: ["the clothes line", "the rent"],
        answer: { index: 0 },
        explanation: "l'étendoir est l'objet sur lequel on fait sécher le linge.",
      },
    ];
    const entries = buildEmailEntries("http://localhost:3000", [
      {
        classroomName: "French with Marie",
        quiz: { id: "quiz-1", classroomId: "class-1" },
        questions,
      },
    ]);

    expect(entries[0]?.quizUrl).toBe(
      "http://localhost:3000/classrooms/class-1/quizzes/quiz-1/take",
    );
    expect(entries[0]?.questions[0]).toEqual({
      position: 0,
      category: "vocabulary",
      type: "mcq",
      stem: "« l'étendoir » veut dire :",
      options: ["the clothes line", "the rent"],
    });
    expect(entries[0]?.questions[0]).not.toHaveProperty("answer");
    expect(entries[0]?.questions[0]).not.toHaveProperty("explanation");
  });
});

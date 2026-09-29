import { describe, expect, it } from "vitest";
import {
  emptyResponseFor,
  gradeAnswer,
  gradeAttempt,
  normalizeAnswerText,
} from "./grading";

describe("normalizeAnswerText", () => {
  it("strips accents and lowercases", () => {
    expect(normalizeAnswerText("Étendoir ")).toBe("etendoir");
    expect(normalizeAnswerText("le bonheur")).toBe("le bonheur");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeAnswerText("  le   bonheur  ")).toBe("le bonheur");
  });
});

describe("gradeAnswer", () => {
  it("grades mcq by index", () => {
    expect(gradeAnswer("mcq", { index: 2 }, { index: 2 })).toBe(true);
    expect(gradeAnswer("mcq", { index: 2 }, { index: 0 })).toBe(false);
    expect(gradeAnswer("mcq", { index: 2 }, null)).toBe(false);
  });

  it("grades image questions by index", () => {
    expect(gradeAnswer("image", { index: 0 }, { index: 0 })).toBe(true);
  });

  it("grades true/false by value", () => {
    expect(gradeAnswer("true_false", { value: false }, { value: false })).toBe(true);
    expect(gradeAnswer("true_false", { value: false }, { value: true })).toBe(false);
    expect(gradeAnswer("true_false", { value: false }, { index: 0 })).toBe(false);
  });

  it("grades fill_blank case- and accent-insensitively", () => {
    const answer = { blanks: ["le bonheur", "la tristesse"] };
    expect(
      gradeAnswer("fill_blank", answer, { blanks: ["Le Bonheur", "la tristesse"] }),
    ).toBe(true);
    expect(
      gradeAnswer("fill_blank", answer, { blanks: ["le bonheur", "la tristesse "] }),
    ).toBe(true);
    expect(gradeAnswer("fill_blank", answer, { blanks: ["le bonheur"] })).toBe(false);
    expect(gradeAnswer("fill_blank", answer, { blanks: ["le bonheur", "la colère"] })).toBe(
      false,
    );
  });

  it("accepts a blank's alternatives, blank by blank", () => {
    const answer = { blanks: ["je paie", "le loyer"], accepted: [["je paye"], []] };
    expect(gradeAnswer("fill_blank", answer, { blanks: ["Je paye", "le loyer"] })).toBe(true);
    expect(gradeAnswer("fill_blank", answer, { blanks: ["je paie", "le loyer"] })).toBe(true);
    expect(gradeAnswer("fill_blank", answer, { blanks: ["le loyer", "je paye"] })).toBe(false);
  });

  it("ignores closing punctuation and curly apostrophes", () => {
    expect(gradeAnswer("fill_blank", { blanks: ["On va voir."] }, { blanks: ["on va voir"] })).toBe(true);
    expect(gradeAnswer("fill_blank", { blanks: ["je n’avais pas"] }, { blanks: ["je n'avais pas"] })).toBe(
      true,
    );
  });

  it("rejects empty or missing blanks", () => {
    const answer = { blanks: ["le bonheur"] };
    expect(gradeAnswer("fill_blank", answer, { blanks: [] })).toBe(false);
    expect(gradeAnswer("fill_blank", answer, { blanks: [null] })).toBe(false);
    expect(gradeAnswer("fill_blank", { blanks: [] }, { blanks: [] })).toBe(false);
  });
});

describe("gradeAttempt", () => {
  it("counts correct answers", () => {
    const result = gradeAttempt(
      [
        { id: "q1", type: "mcq", answer: { index: 1 } },
        { id: "q2", type: "true_false", answer: { value: true } },
        { id: "q3", type: "fill_blank", answer: { blanks: ["etendoir"] } },
      ],
      new Map<string, unknown>([
        ["q1", { index: 1 }],
        ["q2", { value: false }],
        ["q3", { blanks: ["Étendoir"] }],
      ]),
    );
    expect(result.correctCount).toBe(2);
    expect(result.questionCount).toBe(3);
    expect(result.results).toEqual([
      { questionId: "q1", isCorrect: true },
      { questionId: "q2", isCorrect: false },
      { questionId: "q3", isCorrect: true },
    ]);
  });
});

describe("emptyResponseFor", () => {
  it("returns the right shell per type", () => {
    expect(emptyResponseFor("fill_blank")).toEqual({ blanks: [] });
    expect(emptyResponseFor("true_false")).toEqual({ value: null });
    expect(emptyResponseFor("mcq")).toEqual({ index: null });
    expect(emptyResponseFor("image")).toEqual({ index: null });
  });
});

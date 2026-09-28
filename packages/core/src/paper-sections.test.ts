import { describe, expect, it } from "vitest";
import { paperOrder, paperParts, paperSectionOf, partNumeral, questionPoints } from "./paper-sections";

const questions = [
  { id: "a", type: "fill_blank" },
  { id: "b", type: "mcq" },
  { id: "c", type: "true_false" },
  { id: "d", type: "image" },
  { id: "e", type: "fill_blank" },
];

describe("paperSectionOf", () => {
  it("puts image questions with multiple choice", () => {
    expect(paperSectionOf("image")).toBe("choice");
    expect(paperSectionOf("mcq")).toBe("choice");
  });
});

describe("paperOrder", () => {
  it("groups by section and keeps order inside each section", () => {
    expect(paperOrder(questions).map((question) => question.id)).toEqual(["b", "d", "c", "a", "e"]);
  });
});

describe("paperParts", () => {
  it("numbers questions across the paper and skips empty parts", () => {
    const parts = paperParts(questions.filter((question) => question.type !== "true_false"));
    expect(parts.map((part) => [part.section, part.partNumber])).toEqual([
      ["choice", 1],
      ["fill_blank", 2],
    ]);
    expect(parts.flatMap((part) => part.questions.map(({ question, number }) => [question.id, number]))).toEqual([
      ["b", 1],
      ["d", 2],
      ["a", 3],
      ["e", 4],
    ]);
  });
});

describe("partNumeral", () => {
  it("reads the localized numeral and falls back to digits", () => {
    expect(partNumeral("一,二,三", 2)).toBe("二");
    expect(partNumeral("I,II,III", 4)).toBe("4");
  });
});

describe("points", () => {
  it("weights each part by its question type", () => {
    const parts = paperParts(questions);
    expect(parts.map((part) => [part.section, part.pointsEach, part.totalPoints])).toEqual([
      ["choice", 2, 4],
      ["true_false", 1, 1],
      ["fill_blank", 3, 6],
    ]);
    expect(questionPoints("image")).toBe(2);
  });
});

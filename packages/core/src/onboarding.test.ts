import { describe, expect, it } from "vitest";
import { gradeAnswer } from "./grading";
import { LANGUAGES } from "./languages";
import { DEMO_PAPERS } from "./onboarding";
import { paperParts } from "./paper-sections";

describe("DEMO_PAPERS", () => {
  it.each(LANGUAGES.map((language) => language.code))("%s covers every paper part", (code) => {
    const paper = DEMO_PAPERS[code];
    expect(paperParts(paper.questions).map((part) => part.section)).toEqual([
      "choice",
      "true_false",
      "fill_blank",
    ]);
    expect(paper.sampleNotes.trim().length).toBeGreaterThan(0);
  });

  it.each(LANGUAGES.map((language) => language.code))(
    "%s grades every answer right except the last",
    (code) => {
      const questions = DEMO_PAPERS[code].questions;
      const grades = questions.map((question) =>
        gradeAnswer(question.type, question.answer, question.response),
      );
      expect(grades).toEqual([true, true, true, false]);
      for (const question of questions) {
        if (question.type === "mcq") {
          const index = "index" in question.answer ? question.answer.index : -1;
          expect(question.options?.[index]).toBeTruthy();
        }
        if (question.type === "fill_blank") {
          expect(question.stem.match(/_{2,}/g)).toHaveLength(1);
        }
      }
    },
  );
});

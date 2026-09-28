import { describe, expect, it } from "vitest";
import { parseExamReview } from "./exam-review";

describe("parseExamReview", () => {
  it("keeps only missed question numbers, sorted and unique", () => {
    const review = parseExamReview(
      {
        overview: " Solid on vocabulary; tenses slipped. ",
        patterns: [
          { title: "Passé composé vs imparfait", detail: "You wrote « j'allais ».", questions: [17, 3, 3, 99] },
        ],
        next_steps: ["Drill ten past-tense sentences."],
      },
      [3, 17, 21],
    );
    expect(review.overview).toBe("Solid on vocabulary; tenses slipped.");
    expect(review.patterns[0]?.questions).toEqual([3, 17]);
    expect(review.nextSteps).toEqual(["Drill ten past-tense sentences."]);
  });

  it("caps patterns at four and next steps at three", () => {
    const pattern = { title: "t", detail: "d", questions: [] };
    const review = parseExamReview(
      {
        overview: "o",
        patterns: Array.from({ length: 6 }, () => pattern),
        next_steps: ["a", "b", "c", "d"],
      },
      [],
    );
    expect(review.patterns).toHaveLength(4);
    expect(review.nextSteps).toHaveLength(3);
  });

  it("rejects a review with no patterns", () => {
    expect(() => parseExamReview({ overview: "o", patterns: [] }, [])).toThrow();
  });
});

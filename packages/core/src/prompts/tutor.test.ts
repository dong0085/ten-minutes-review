import { describe, expect, it } from "vitest";
import { answerGiveaways, parseTutorAnalysis, parseTutorHint } from "./tutor";

describe("tutor hints", () => {
  const options = ["le boulanger", "la boulangerie", "le boucher", "le barbier"];

  it("collects the right option and blanks as giveaways, skipping tiny words", () => {
    expect(answerGiveaways("mcq", options, { index: 0 })).toEqual(["le boulanger"]);
    expect(answerGiveaways("fill_blank", null, { blanks: ["rouge à lèvres", "la"] })).toEqual([
      "rouge a levres",
    ]);
    expect(answerGiveaways("true_false", null, { value: true })).toEqual([]);
  });

  it("rejects a hint that spells out the answer, accents and case aside", () => {
    const giveaways = answerGiveaways("fill_blank", null, { blanks: ["rouge à lèvres"] });
    expect(() => parseTutorHint({ hint: "C'est ROUGE A LEVRES, bien sûr." }, giveaways)).toThrow(
      "gave away",
    );
    expect(parseTutorHint({ hint: " Think of what goes on lips. " }, giveaways)).toEqual({
      hint: "Think of what goes on lips.",
    });
  });

  it("keeps at most two analysis examples", () => {
    const analysis = parseTutorAnalysis({
      diagnosis: "d",
      rule: "r",
      examples: [{ target: "a" }, { target: "b", translation: "B" }, { target: "c" }],
    });
    expect(analysis.examples).toEqual([
      { target: "a", translation: "" },
      { target: "b", translation: "B" },
    ]);
    expect(analysis.tip).toBe("");
  });
});

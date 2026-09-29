// Runs the Jev review on four questions whose verdict is known, to check that
// the review questions and thresholds in ../review.ts catch what they should.
//
//   pnpm --filter worker eval:jev-calibrate
import type { CompositionQuestion } from "@tmr/core";
import { createJevClient } from "../jev";
import type { CompositionPayload } from "../llm";
import { reviewQuestion } from "../review";

const payload: CompositionPayload = {
  targetLanguage: "fr",
  nativeLanguage: "en",
  size: 4,
  knowledgePoints: [
    { id: "etendoir", category: "vocabulary", target: "l'étendoir", native: "the clothes line", detail: null },
    { id: "epuise", category: "vocabulary", target: "épuisant", native: "exhausting", detail: null },
    { id: "preparer", category: "phrase", target: "se préparer pour", native: "to prepare for", detail: null },
  ],
  alreadyAskedStems: [],
  recentMisses: [],
};

const cases: { name: string; expect: string; question: CompositionQuestion }[] = [
  {
    name: "giveaway",
    expect: "reveals_answer",
    question: {
      knowledge_point_id: "etendoir",
      category: "vocabulary",
      type: "mcq",
      stem: "Quel objet utilisé pour faire sécher le linge à l'extérieur est un étendoir ?",
      options: ["Un étendoir", "Un fer à repasser", "Une machine à laver", "Un aspirateur"],
      answer: { index: 0 },
      explanation: "Un étendoir sert à faire sécher le linge.",
    },
  },
  {
    name: "good",
    expect: "nothing",
    question: {
      knowledge_point_id: "etendoir",
      category: "vocabulary",
      type: "mcq",
      stem: "Comment dit-on « the clothes line » ?",
      options: ["l'étendoir", "la pince à linge", "le séchoir", "la corde à sauter"],
      answer: { index: 0 },
      explanation: "« L'étendoir » est l'objet sur lequel on fait sécher le linge.",
    },
  },
  {
    name: "wrong answer",
    expect: "answer_wrong",
    question: {
      knowledge_point_id: "epuise",
      category: "vocabulary",
      type: "fill_blank",
      stem: "Après une longue journée de marche, je suis ___ (exhausted).",
      options: null,
      answer: { blanks: ["épuisant"] },
      explanation: "« Épuisant » veut dire exhausting.",
    },
  },
  {
    name: "two right",
    expect: "several_right",
    question: {
      knowledge_point_id: "preparer",
      category: "phrase",
      type: "mcq",
      stem: "Comment dit-on « to prepare for » ?",
      options: ["se préparer pour", "se préparer à", "se préparer de", "se préparer avec"],
      answer: { index: 0 },
      explanation: "« Se préparer pour » veut dire to prepare for.",
    },
  },
];

const jev = createJevClient();
for (const { name, expect, question } of cases) {
  const review = await reviewQuestion(jev, payload, question);
  const problems = Object.entries(review.problems)
    .map(([check, probability]) => `${check}=${probability}`)
    .join(" ");
  console.log(
    `${name.padEnd(13)} expect ${expect.padEnd(15)} failed [${review.failed.join(", ")}]  ` +
      `quality=${review.quality} (confidence ${review.confidence})  ${problems}`,
  );
}

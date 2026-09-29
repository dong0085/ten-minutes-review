// Reviews composed questions with Jev and rewrites the ones it rejects, once.
// A rewrite that still fails is set aside; the spare points fill its place.
import {
  REWRITE_PROMPT_V1,
  parseCompositionResponse,
  parseCompositionResult,
  sanitizeCompositionQuestions,
} from "@tmr/core";
import type { CompositionQuestion } from "@tmr/core";
import type { JevClient, JevQuestion } from "./jev";
import type { CompositionPayload, LlmProvider } from "./llm";

export const REVIEW_CHECKS = ["reveals_answer", "answer_wrong", "several_right", "weak_distractors"] as const;

export type ReviewCheck = (typeof REVIEW_CHECKS)[number] | "low_quality";

/** A check fails when Jev puts the problem at or above this probability. */
export const PROBLEM_THRESHOLD = 0.5;
/** Jev scores quality 0 (broken) to 4 (excellent); below this the question is rewritten. */
export const QUALITY_FLOOR = 1.5;

export type QuestionReview = {
  /** Jev's probability for each problem it was asked about. */
  problems: Partial<Record<(typeof REVIEW_CHECKS)[number], number>>;
  quality: number;
  confidence: number;
  failed: ReviewCheck[];
};

export type ReviewStats = {
  reviewed: number;
  unreviewed: number;
  rewritten: number;
  rescued: number;
  rejected: number;
};

export type ReviewOutcome = {
  kept: CompositionQuestion[];
  /** Questions that failed after one rewrite, best quality first. */
  rejected: { question: CompositionQuestion; review: QuestionReview }[];
  stats: ReviewStats;
};

const QUALITY_LEVELS = [
  "Broken or misleading: wrong answer, several right answers, or the answer is given away.",
  "Weak: works, but the wrong options are obvious or the wording is off.",
  "Usable: a fair question with small flaws.",
  "Good: a question a teacher would use.",
  "Excellent: tests the point sharply, with natural wording and believable wrong options.",
];

function hasOptions(question: CompositionQuestion): boolean {
  return (question.type === "mcq" || question.type === "image") && Boolean(question.options?.length);
}

export function reviewQuestions(question: CompositionQuestion): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {
    reveals_answer: {
      type: "noul",
      instructions:
        "Does the question text reveal the marked answer, so a learner who does not know the point could answer by matching words between the stem and the options? A native-language translation cue does not count.",
      criteria: { true: "Yes, the question text reveals the answer.", false: "No, the learner must know the point." },
    },
    answer_wrong: {
      type: "noul",
      instructions:
        "Is the marked answer, or any alternative listed after \"or\", wrong, misspelled, not standard usage, or a poor fit for the sentence (gender, number, verb form, doubled article)?",
      criteria: { true: "Yes, the marked answer is wrong.", false: "No, the marked answer is correct." },
    },
    several_right: {
      type: "noul",
      instructions:
        "For options: is more than one option correct? For a typed blank, graded by exact match: would a learner who knows the point reasonably type a correct answer that is not listed in markedAnswer?",
      criteria: {
        true: "Yes, a correct answer would be marked wrong or another option is also right.",
        false: "No, every correct answer is accepted and exactly one option is right.",
      },
    },
    quality: {
      type: "score",
      instructions: "How good is this as a quiz question for a language learner?",
      criteria: QUALITY_LEVELS,
    },
  };
  if (hasOptions(question)) {
    questions.weak_distractors = {
      type: "noul",
      instructions:
        "Are the wrong options easy to rule out because they come from a different topic or word class than the right answer?",
      criteria: { true: "Yes, the wrong options are obviously wrong.", false: "No, they could fool someone who half-knows the point." },
    };
  }
  return questions;
}

function markedAnswer(question: CompositionQuestion): string {
  const answer = question.answer;
  if ("index" in answer) {
    return question.options?.[answer.index] ?? "";
  }
  if ("blanks" in answer) {
    return answer.blanks
      .map((blank, index) => [blank, ...(answer.accepted?.[index] ?? [])].join(" or "))
      .join(" | ");
  }
  return answer.value ? "true" : "false";
}

export function reviewState(payload: CompositionPayload, question: CompositionQuestion) {
  const point = payload.knowledgePoints.find((candidate) => candidate.id === question.knowledge_point_id);
  return {
    targetLanguage: payload.targetLanguage,
    nativeLanguage: payload.nativeLanguage,
    knowledgePoint: point ? { category: point.category, target: point.target, native: point.native } : null,
    type: question.type,
    stem: question.stem,
    options: question.options,
    markedAnswer: markedAnswer(question),
    explanation: question.explanation,
  };
}

export async function reviewQuestion(
  jev: JevClient,
  payload: CompositionPayload,
  question: CompositionQuestion,
): Promise<QuestionReview> {
  const answers = await jev.ask(reviewState(payload, question), reviewQuestions(question));
  const problems: QuestionReview["problems"] = {};
  const failed: ReviewCheck[] = [];
  for (const check of REVIEW_CHECKS) {
    const probability = answers[check]?.noul;
    if (typeof probability !== "number") {
      continue;
    }
    problems[check] = probability;
    if (probability >= PROBLEM_THRESHOLD) {
      failed.push(check);
    }
  }
  const quality = answers.quality?.score ?? QUALITY_LEVELS.length - 1;
  if (quality < QUALITY_FLOOR) {
    failed.push("low_quality");
  }
  return { problems, quality, confidence: answers.quality?.confidence ?? 0, failed };
}

async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(work))));
  }
  return results;
}

const CONCURRENCY = 4;

/** Reviews each question; a Jev failure leaves that question unreviewed rather than blocking the quiz. */
async function reviewAll(jev: JevClient, payload: CompositionPayload, questions: CompositionQuestion[]) {
  return inBatches(questions, CONCURRENCY, async (question) => {
    try {
      return { question, review: await reviewQuestion(jev, payload, question) };
    } catch (error) {
      console.warn("[review] Jev could not review a question", error);
      return { question, review: null };
    }
  });
}

function round2(probability: number): number {
  return Math.round(probability * 100) / 100;
}

export function rewritePayload(
  payload: CompositionPayload,
  failing: { question: CompositionQuestion; review: QuestionReview }[],
) {
  const points = new Map(payload.knowledgePoints.map((point) => [point.id, point]));
  return {
    targetLanguage: payload.targetLanguage,
    nativeLanguage: payload.nativeLanguage,
    alreadyAskedStems: payload.alreadyAskedStems,
    items: failing.map(({ question, review }) => ({
      knowledgePoint: points.get(question.knowledge_point_id),
      rejectedQuestion: question,
      failedChecks: Object.fromEntries(
        review.failed.map((check) => [
          check,
          check === "low_quality" ? round2(review.quality) : round2(review.problems[check] ?? 0),
        ]),
      ),
      qualityScore: round2(review.quality),
    })),
  };
}

export async function reviewAndRewrite(input: {
  jev: JevClient;
  provider: LlmProvider;
  payload: CompositionPayload;
  questions: CompositionQuestion[];
}): Promise<ReviewOutcome> {
  const { jev, provider, payload, questions } = input;
  const first = await reviewAll(jev, payload, questions);
  const stats: ReviewStats = {
    reviewed: first.filter((entry) => entry.review).length,
    unreviewed: first.filter((entry) => !entry.review).length,
    rewritten: 0,
    rescued: 0,
    rejected: 0,
  };
  const failing = first.filter(
    (entry): entry is { question: CompositionQuestion; review: QuestionReview } =>
      entry.review !== null && entry.review.failed.length > 0,
  );
  if (failing.length === 0) {
    return { kept: questions, rejected: [], stats };
  }

  const replacements = new Map<CompositionQuestion, CompositionQuestion>();
  const rejected: ReviewOutcome["rejected"] = [];
  try {
    const raw = await provider.compose({ systemPrompt: REWRITE_PROMPT_V1, payload: rewritePayload(payload, failing) });
    const failingIds = new Set(failing.map(({ question }) => question.knowledge_point_id));
    const parsed = typeof raw === "string" ? parseCompositionResponse(raw) : parseCompositionResult(raw);
    const { kept: rewrites } = sanitizeCompositionQuestions(parsed.questions, failingIds);
    stats.rewritten = rewrites.length;
    const second = await reviewAll(jev, payload, rewrites);
    for (const entry of failing) {
      const match = second.find(
        (candidate) =>
          candidate.question.knowledge_point_id === entry.question.knowledge_point_id &&
          candidate.question.type === entry.question.type &&
          ![...replacements.values()].includes(candidate.question),
      );
      if (match && (!match.review || match.review.failed.length === 0)) {
        replacements.set(entry.question, match.question);
        stats.rescued += 1;
      } else {
        rejected.push(match?.review ? { question: match.question, review: match.review } : entry);
      }
    }
  } catch (error) {
    console.warn("[review] rewrite failed; setting the rejected questions aside", error);
    rejected.push(...failing);
  }

  const rejectedOriginals = new Set(failing.map(({ question }) => question));
  const kept = questions.flatMap((question) => {
    const replacement = replacements.get(question);
    if (replacement) {
      return [replacement];
    }
    return rejectedOriginals.has(question) ? [] : [question];
  });
  stats.rejected = rejected.length;
  rejected.sort((a, b) => b.review.quality - a.review.quality);
  return { kept, rejected, stats };
}

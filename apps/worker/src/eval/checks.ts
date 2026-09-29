import { normalizeAnswerText, sanitizeCompositionQuestions } from "@tmr/core";
import type { CompositionQuestion } from "@tmr/core";
import type { CompositionPayload } from "../llm";

/** Problems code can spot on its own, one name per rule. */
export type CodeFlag =
  | "dropped"
  | "duplicate_options"
  | "too_few_options"
  | "blank_count_mismatch"
  | "no_cue"
  | "repeats_asked_stem";

export type CheckedQuestion = {
  question: CompositionQuestion;
  flags: CodeFlag[];
  dropReason: string | null;
};

export type CaseCheck = {
  questions: CheckedQuestion[];
  pointCount: number;
  /** Knowledge points the model wrote no question for. */
  missingPoints: string[];
  /** Questions whose knowledge point was not in the payload. */
  unknownPoints: number;
};

const BLANK = /_{2,}/g;

function blankCount(stem: string): number {
  return stem.match(BLANK)?.length ?? 0;
}

function hasCue(stem: string): boolean {
  return /\([^)]+\)/.test(stem) || /«[^»]+»|"[^"]+"|“[^”]+”/.test(stem);
}

export function checkQuestion(
  question: CompositionQuestion,
  asked: ReadonlySet<string>,
): CodeFlag[] {
  const flags: CodeFlag[] = [];
  if (question.type === "mcq" || question.type === "image") {
    const options = question.options ?? [];
    if (options.length < 3) {
      flags.push("too_few_options");
    }
    if (new Set(options.map(normalizeAnswerText)).size !== options.length) {
      flags.push("duplicate_options");
    }
  }
  if (question.type === "fill_blank") {
    const answer = question.answer as { blanks?: string[] };
    if (blankCount(question.stem) !== (answer.blanks?.length ?? 0)) {
      flags.push("blank_count_mismatch");
    }
    if (!hasCue(question.stem)) {
      flags.push("no_cue");
    }
  }
  if (asked.has(normalizeAnswerText(question.stem))) {
    flags.push("repeats_asked_stem");
  }
  return flags;
}

export function checkCase(payload: CompositionPayload, questions: CompositionQuestion[]): CaseCheck {
  const ids = new Set(payload.knowledgePoints.map((point) => point.id));
  const asked = new Set(payload.alreadyAskedStems.map(normalizeAnswerText));
  const { dropped } = sanitizeCompositionQuestions(questions, ids);
  const dropReasons = new Map(dropped.map((entry) => [entry.question, entry.reason]));

  const covered = new Set(questions.map((question) => question.knowledge_point_id));
  return {
    questions: questions.map((question) => {
      const dropReason = dropReasons.get(question) ?? null;
      const flags = checkQuestion(question, asked);
      return { question, dropReason, flags: dropReason ? ["dropped", ...flags] : flags };
    }),
    pointCount: ids.size,
    missingPoints: [...ids].filter((id) => !covered.has(id)),
    unknownPoints: questions.filter((question) => !ids.has(question.knowledge_point_id)).length,
  };
}

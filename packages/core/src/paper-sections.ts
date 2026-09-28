import type { QuestionType } from "./types";

/** The parts of a quiz paper, in the order they are printed. */
export const PAPER_SECTIONS = ["choice", "true_false", "fill_blank"] as const;

export type PaperSection = (typeof PAPER_SECTIONS)[number];

/** Points for one question in each part; recall (fill-in) counts most. */
export const PAPER_POINTS: Record<PaperSection, number> = {
  choice: 2,
  true_false: 1,
  fill_blank: 3,
};

export function paperSectionOf(type: QuestionType | string): PaperSection {
  if (type === "true_false" || type === "fill_blank") {
    return type;
  }
  return "choice";
}

/** Questions in paper order: grouped by section, keeping their order inside each section. */
export function paperOrder<T extends { type: QuestionType | string }>(questions: readonly T[]): T[] {
  return PAPER_SECTIONS.flatMap((section) =>
    questions.filter((question) => paperSectionOf(question.type) === section),
  );
}

export type PaperPart<T> = {
  section: PaperSection;
  /** 1-based part number, counting only the parts that have questions. */
  partNumber: number;
  pointsEach: number;
  totalPoints: number;
  questions: { question: T; number: number }[];
};

/** Questions grouped into numbered parts, with question numbers running across the whole paper. */
export function paperParts<T extends { type: QuestionType | string }>(
  questions: readonly T[],
  points: Record<PaperSection, number> = PAPER_POINTS,
): PaperPart<T>[] {
  const parts: PaperPart<T>[] = [];
  let number = 0;
  for (const section of PAPER_SECTIONS) {
    const inSection = questions.filter((question) => paperSectionOf(question.type) === section);
    if (inSection.length === 0) {
      continue;
    }
    parts.push({
      section,
      partNumber: parts.length + 1,
      pointsEach: points[section],
      totalPoints: points[section] * inSection.length,
      questions: inSection.map((question) => ({ question, number: (number += 1) })),
    });
  }
  return parts;
}

/** The numeral for a part, from a localized comma-separated list such as "I,II,III". */
export function partNumeral(numerals: string, partNumber: number): string {
  return numerals.split(",")[partNumber - 1]?.trim() || String(partNumber);
}

export function questionPoints(
  type: QuestionType | string,
  points: Record<PaperSection, number> = PAPER_POINTS,
): number {
  return points[paperSectionOf(type)];
}

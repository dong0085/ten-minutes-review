import type { QuestionAnswer, QuestionResponse, QuestionType, UiLocale } from "@tmr/core";

/** The language a model writes feedback in, by interface locale. */
export const WRITE_IN: Record<UiLocale, string> = {
  en: "English",
  fr: "French",
  zh: "Simplified Chinese",
};

function optionText(options: string[] | null, index: number | null | undefined): string | null {
  if (index === null || index === undefined) {
    return null;
  }
  return options?.[index] ?? null;
}

/** The learner's answer as plain text, or "(blank)" when they left it. */
export function describeResponse(
  type: QuestionType,
  options: string[] | null,
  response: QuestionResponse | null,
): string {
  if (type === "mcq" || type === "image") {
    return optionText(options, response?.index) ?? "(blank)";
  }
  if (type === "true_false") {
    return typeof response?.value === "boolean" ? String(response.value) : "(blank)";
  }
  const blanks = (response?.blanks ?? []).map((blank) => blank?.trim() || "(blank)");
  return blanks.length > 0 ? blanks.join(" / ") : "(blank)";
}

export function describeAnswer(
  type: QuestionType,
  options: string[] | null,
  answer: QuestionAnswer,
): string {
  if ((type === "mcq" || type === "image") && "index" in answer) {
    return optionText(options, answer.index) ?? String(answer.index);
  }
  if (type === "true_false" && "value" in answer) {
    return String(answer.value);
  }
  if ("blanks" in answer) {
    return answer.blanks.join(" / ");
  }
  return JSON.stringify(answer);
}

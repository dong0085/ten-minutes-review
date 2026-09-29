import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "use-intl";
import { isIndexOrder, type PaperPart } from "@tmr/core";
import { motion, type Variants } from "motion/react";
import { cn } from "@tmr/ui/utils";
import { PopMark, ScoreStamp } from "./marks";
import type { LocalResponse, QuizQuestion } from "./types";

export type ScantronGrade = {
  isCorrect: boolean;
  correctAnswer: { index?: number | null; value?: boolean | null } | null | undefined;
};

/** Six digits for the candidate-number grid, read off the quiz id so they stay put. */
function candidateDigits(seed: string): number[] {
  const hex = seed.replace(/[^0-9a-f]/gi, "").padEnd(12, "0");
  return Array.from({ length: 6 }, (_, index) => parseInt(hex.slice(index * 2, index * 2 + 2), 16) % 10);
}

/** Bar widths for the printed barcode, also read off the quiz id. */
function barcodeBars(seed: string): number[] {
  const hex = seed.replace(/[^0-9a-f]/gi, "").padEnd(24, "0");
  return Array.from(hex.slice(0, 24), (char) => (parseInt(char, 16) % 3) + 1);
}

const LEAD: Variants = {
  empty: { opacity: 0, clipPath: "inset(0 100% 0 0)", filter: "blur(0px)", scale: 1, x: 0 },
  // Scribbled in from the left, pressing a little past the edge.
  filled: {
    opacity: 0.94,
    clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
    filter: "blur(0px)",
    scale: [1, 1.12, 1],
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  // Rubbed out side to side, leaving a faint smudge.
  erased: {
    opacity: 0.13,
    clipPath: "inset(0 0% 0 0)",
    filter: "blur(0.6px)",
    scale: 1.15,
    x: [0, -1.5, 1.5, -1, 0],
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

function Bubble({
  label,
  filled,
  erased,
  graded,
  ariaLabel,
  onClick,
}: {
  label: string;
  filled: boolean;
  erased: boolean;
  graded?: "right" | "missed" | null;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-pressed={filled}
      disabled={!onClick}
      onClick={onClick}
      className={cn("scantron-bubble", graded === "missed" && "is-missed")}
    >
      <motion.span
        aria-hidden="true"
        className="scantron-lead"
        variants={LEAD}
        initial={false}
        animate={filled ? "filled" : erased ? "erased" : "empty"}
      />
      <span aria-hidden="true">{label}</span>
      {graded === "right" ? <PopMark aria-hidden className="scantron-ring" /> : null}
    </button>
  );
}

/**
 * The answer sheet beside an exam: an optical-mark card printed in the theme's
 * ink and filled in pencil. It mirrors the paper both ways — marking a bubble
 * answers the question, marking it again erases it, and answering on the paper
 * fills the bubble.
 */
export function Scantron({
  seed,
  candidateName,
  subject,
  date,
  parts,
  responses,
  optionOrders,
  erased,
  grades,
  earned,
  activeQuestionId,
  onAnswer,
  onJump,
}: {
  seed: string;
  candidateName: string;
  subject: string;
  date: string;
  parts: PaperPart<QuizQuestion>[];
  responses: Record<string, LocalResponse>;
  optionOrders: Record<string, number[]>;
  erased: ReadonlySet<string>;
  grades: ReadonlyMap<string, ScantronGrade> | null;
  earned: number | null;
  activeQuestionId: string | null;
  onAnswer: (questionId: string, response: LocalResponse) => void;
  onJump: (questionId: string) => void;
}) {
  const t = useTranslations("Quiz.Scantron");
  const tPaper = useTranslations("Quiz.Paper");
  const tfMarks = t("tfMarks").split(",");
  const digits = candidateDigits(seed);
  const locked = grades !== null;

  // Timing marks run down the card's outer edge only, beside the first column.
  const row = (question: QuizQuestion, number: number, bubbles: ReactNode, edge: boolean) => {
    const grade = grades?.get(question.id);
    return (
      <div
        key={question.id}
        role="group"
        aria-label={t("questionLabel", { number })}
        className={cn("scantron-row", activeQuestionId === question.id && "is-active")}
      >
        {edge ? <span aria-hidden="true" className="scantron-timing" /> : null}
        <button
          type="button"
          tabIndex={-1}
          className="scantron-number"
          onClick={() => onJump(question.id)}
        >
          {number}
        </button>
        <span className="flex gap-[0.3rem]">{bubbles}</span>
        {grade && !grade.isCorrect ? (
          <PopMark aria-hidden className="scantron-flag">
            ✗
          </PopMark>
        ) : null}
      </div>
    );
  };

  return (
    <div className="scantron" aria-label={t("title")}>
      <header className="space-y-3 border-b border-[var(--ink-line)] pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-heading text-2xl leading-none font-semibold tracking-[0.12em] text-[var(--ink)]">
              {t("title")}
            </p>
            <p className="mt-1 text-[0.6rem] font-bold tracking-[0.3em] text-[var(--ink)] uppercase">
              {t("subtitle")}
            </p>
          </div>
          <div className="scantron-barcode" aria-label={t("barcode")}>
            {barcodeBars(seed).map((width, index) => (
              <span key={index} style={{ width: `${width}px` }} className={index % 2 ? "opacity-0" : ""} />
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[0.7rem]">
          <dt className="text-[var(--ink)]">{t("name")}</dt>
          <dd className="scantron-field pencil-writing">{candidateName}</dd>
          <dt className="text-[var(--ink)]">{t("subject")}</dt>
          <dd className="scantron-field pencil-writing">{subject}</dd>
          <dt className="text-[var(--ink)]">{t("date")}</dt>
          <dd className="scantron-field pencil-writing">{date}</dd>
        </dl>

        <div className="flex gap-3">
          <div className="shrink-0">
            <p className="text-[0.6rem] text-[var(--ink)]">{t("candidateNo")}</p>
            <div className="mt-1 grid grid-cols-6 gap-px border border-[var(--ink-line)] p-1">
              {digits.map((digit, column) => (
                <div key={column} className="flex flex-col items-center gap-[2px]">
                  <span className="pencil-writing grid h-3.5 w-full place-items-center border-b border-[var(--ink-line)] text-[0.65rem]">
                    {digit}
                  </span>
                  {Array.from({ length: 10 }, (_, value) => (
                    <span
                      key={value}
                      aria-hidden="true"
                      className={cn("scantron-mini", value === digit && "is-filled")}
                    >
                      {value}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-[0.6rem] leading-snug text-[var(--ink)]">
            <p className="font-bold">{t("pencil")}</p>
            <ol className="list-decimal space-y-0.5 pl-3">
              <li>{t("ruleFill")}</li>
              <li>{t("ruleErase")}</li>
              <li>{t("ruleClean")}</li>
            </ol>
            <div className="space-y-1 border border-[var(--ink-line)] p-1.5">
              <p className="flex items-center gap-1.5">
                {t("correctMark")}
                <span className="scantron-mini is-filled" aria-hidden="true" />
              </p>
              <p className="flex items-center gap-1.5">
                {t("wrongMarks")}
                <span className="scantron-mini" aria-hidden="true">✓</span>
                <span className="scantron-mini" aria-hidden="true">✗</span>
                <span className="scantron-mini" aria-hidden="true">•</span>
                <span className="scantron-mini is-half" aria-hidden="true" />
              </p>
            </div>
          </div>
          {earned !== null ? (
            <div className="grid w-14 shrink-0 place-items-center border border-[var(--ink-line)] text-center">
              <span className="text-[0.6rem] text-[var(--ink)]">{t("score")}</span>
              <ScoreStamp className="font-heading text-2xl font-semibold text-destructive">
                {earned}
              </ScoreStamp>
            </div>
          ) : null}
        </div>
      </header>

      {parts.map((part) => (
        <section key={part.section} className="pt-3">
          <p className="mb-1.5 flex items-baseline justify-between text-[0.7rem] font-semibold text-[var(--ink)]">
            <span>
              {tPaper("part", {
                numeral: tPaper("numerals").split(",")[part.partNumber - 1] ?? String(part.partNumber),
                title: tPaper(part.section),
              })}
            </span>
          </p>
          {part.section === "fill_blank" ? (
            <div className="space-y-1">
              <p className="text-[0.58rem] leading-snug text-[var(--ink)]">{t("writtenNote")}</p>
              {part.questions.map(({ question, number }) => {
                const blanks = (responses[question.id]?.blanks ?? []).filter(
                  (blank): blank is string => !!blank && blank.trim() !== "",
                );
                const grade = grades?.get(question.id);
                return (
                  <button
                    key={question.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => onJump(question.id)}
                    className={cn(
                      "scantron-written",
                      activeQuestionId === question.id && "is-active",
                    )}
                  >
                    <span className="scantron-timing" aria-hidden="true" />
                    <span className="w-5 shrink-0 text-right text-[0.65rem] text-[var(--ink)] tabular-nums">
                      {number}
                    </span>
                    <span
                      className={cn(
                        "pencil-writing min-w-0 flex-1 truncate text-left",
                        grade && !grade.isCorrect && "line-through decoration-destructive",
                      )}
                    >
                      {blanks.join(" / ")}
                    </span>
                    {grade && !grade.isCorrect ? (
                      <PopMark aria-hidden className="scantron-flag">
                        ✗
                      </PopMark>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3">
              {[0, 1].map((column) => {
                const half = Math.ceil(part.questions.length / 2);
                const slice = part.questions.slice(column * half, (column + 1) * half);
                return (
                  <div key={column} className="scantron-column">
                    {slice.map(({ question, number }) => {
                      const response = responses[question.id];
                      const grade = grades?.get(question.id);
                      if (part.section === "true_false") {
                        return row(
                          question,
                          number,
                          [true, false].map((value, index) => {
                            const key = `${question.id}:${String(value)}`;
                            return (
                              <Bubble
                                key={key}
                                label={tfMarks[index] ?? (value ? "T" : "F")}
                                filled={response?.value === value}
                                erased={erased.has(key)}
                                graded={
                                  grade && grade.correctAnswer?.value === value
                                    ? "right"
                                    : grade && response?.value === value && !grade.isCorrect
                                      ? "missed"
                                      : null
                                }
                                ariaLabel={t("optionLabel", {
                                  number,
                                  option: tfMarks[index] ?? "",
                                })}
                                onClick={
                                  locked
                                    ? undefined
                                    : () =>
                                        onAnswer(question.id, {
                                          value: response?.value === value ? null : value,
                                        })
                                }
                              />
                            );
                          }),
                          column === 0,
                        );
                      }
                      const count = question.options?.length ?? 0;
                      const stored = optionOrders[question.id];
                      const order =
                        stored && isIndexOrder(stored, count)
                          ? stored
                          : Array.from({ length: count }, (_, index) => index);
                      return row(
                        question,
                        number,
                        order.map((optionIndex, displayIndex) => {
                          const key = `${question.id}:${optionIndex}`;
                          const letter = String.fromCharCode(65 + displayIndex);
                          return (
                            <Bubble
                              key={key}
                              label={letter}
                              filled={response?.index === optionIndex}
                              erased={erased.has(key)}
                              graded={
                                grade && grade.correctAnswer?.index === optionIndex
                                  ? "right"
                                  : grade && response?.index === optionIndex && !grade.isCorrect
                                    ? "missed"
                                    : null
                              }
                              ariaLabel={t("optionLabel", { number, option: letter })}
                              onClick={
                                locked
                                  ? undefined
                                  : () =>
                                      onAnswer(question.id, {
                                        index: response?.index === optionIndex ? null : optionIndex,
                                      })
                              }
                            />
                          );
                        }),
                        column === 0,
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      <footer className="mt-4 flex items-center justify-between border-t border-[var(--ink-line)] pt-2">
        <span className="text-[0.55rem] tracking-[0.2em] text-[var(--ink)] uppercase">
          {t("footer")}
        </span>
        <span aria-hidden="true" className="flex gap-1">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="h-1 w-2.5 bg-foreground" style={{ opacity: 0.85 } as CSSProperties} />
          ))}
        </span>
      </footer>
    </div>
  );
}

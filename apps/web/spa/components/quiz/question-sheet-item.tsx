import { useRef, type ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Check, X } from "lucide-react";
import { isIndexOrder } from "@tmr/core";
import { Badge } from "@tmr/ui/components/badge";
import { Label } from "@tmr/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@tmr/ui/components/radio-group";
import { cn } from "@tmr/ui/utils";
import { PenCircle, PenMark, PopMark } from "./marks";
import { OmitKnowledgePointButton } from "./omit-knowledge-point-button";
import type { AnswerShape } from "./question-review";
import type { LocalResponse, QuizQuestion } from "./types";

export type QuestionGrade = {
  questionId: string;
  knowledgePointId?: string;
  isKnowledgePointRetired?: boolean;
  isCorrect: boolean;
  correctAnswer: AnswerShape;
  explanation: string;
};

export function blankCount(stem: string): number {
  const matches = stem.match(/_{2,}/g);
  return Math.max(1, matches?.length ?? 0);
}

export function isAnswered(question: QuizQuestion, response: LocalResponse | undefined): boolean {
  if (!response) {
    return false;
  }
  if (question.type === "fill_blank") {
    return (response.blanks ?? []).some((blank) => (blank ?? "").trim() !== "");
  }
  if (question.type === "true_false") {
    return response.value === true || response.value === false;
  }
  return typeof response.index === "number";
}

/** An answer bubble, filled in with the theme colour when chosen. */
function Bubble({ selected, children }: { selected: boolean; children?: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-6 shrink-0 place-items-center rounded-full border text-[0.7rem] font-semibold transition",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/45 text-muted-foreground group-hover/option:border-primary/60",
      )}
    >
      {children}
    </span>
  );
}

const optionRowClass =
  "group/option -mx-2 flex w-auto cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[0.95rem] leading-normal font-normal transition hover:bg-muted/60 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30";

export function QuestionSheetItem({
  ref,
  question,
  number,
  points,
  isLast,
  response,
  optionOrder,
  categoryLabel,
  pointId,
  isOmitted,
  grade,
  markOrder,
  onToggleOmit,
  onAnswer,
  onActivate,
  onAdvance,
  kicker,
  children,
  as: Root = "li",
}: {
  ref: (element: HTMLElement | null) => void;
  /** The root element; a list outside this item can supply the list item. */
  as?: "li" | "div";
  question: QuizQuestion;
  number: number;
  /** Printed after the stem and taken off a wrong answer; left out off the paper. */
  points?: number;
  isLast: boolean;
  response: LocalResponse | undefined;
  optionOrder: number[] | undefined;
  categoryLabel: string;
  pointId: string | undefined;
  isOmitted: boolean;
  grade: QuestionGrade | undefined;
  markOrder: number;
  onToggleOmit?: (pointId: string, omitted: boolean) => void;
  onAnswer: (response: LocalResponse) => void;
  onActivate: () => void;
  onAdvance: () => void;
  /** A line above the stem, such as where the question came from. */
  kicker?: ReactNode;
  /** Rendered under the question, after its marks: a check button, a tutor. */
  children?: ReactNode;
}) {
  const t = useTranslations("Quiz.Runner");
  const tReview = useTranslations("Quiz.QuestionReview");
  const tPaper = useTranslations("Quiz.Paper");
  const blankRefs = useRef<(HTMLInputElement | null)[]>([]);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trueFalseRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sourceOptions = question.options ?? [];
  const order =
    optionOrder && isIndexOrder(optionOrder, sourceOptions.length)
      ? optionOrder
      : sourceOptions.map((_, index) => index);
  const blanks = question.type === "fill_blank" ? blankCount(question.stem) : 0;
  const correctBlanks = (grade?.correctAnswer?.blanks ?? []).filter(
    (blank): blank is string => !!blank && blank.trim() !== "",
  );
  const shortOptions = sourceOptions.every((option) => option.length <= 28);
  // The teacher's red circle around the right choice.
  const circle = <PenCircle order={markOrder} className="rotate-[-8deg] text-destructive/75" />;

  const blankInput = (index: number) => (
    <input
      key={`blank-${index}`}
      id={`${question.id}-blank-${index}`}
      ref={(element) => {
        blankRefs.current[index] = element;
      }}
      aria-label={t("blank", { number: index + 1 })}
      autoComplete="off"
      spellCheck={false}
      value={response?.blanks?.[index] ?? ""}
      enterKeyHint={index < blanks - 1 || !isLast ? "next" : "done"}
      className={cn(
        "mx-1 inline-block max-w-full min-w-24 border-0 border-b-[1.5px] border-foreground/55 bg-transparent px-1 pb-0.5 text-center font-sans text-[0.95rem] text-primary outline-none [field-sizing:content] focus:border-primary",
        grade && !grade.isCorrect && "text-destructive line-through decoration-2",
      )}
      onChange={(event) => {
        const next = Array.from(
          { length: blanks },
          (_, blankIndex) => response?.blanks?.[blankIndex] ?? "",
        );
        next[index] = event.target.value;
        onAnswer({ blanks: next });
      }}
    />
  );
  // Fill-in questions are answered on the line, inside the sentence.
  const stemParts = question.stem.split(/_{2,}/);
  const inlineBlanks = question.type === "fill_blank" && stemParts.length > 1;

  return (
    <Root
      ref={ref}
      aria-labelledby={`${question.id}-stem`}
      className="flex scroll-mt-24 items-start gap-3 break-inside-avoid"
      onFocusCapture={onActivate}
      onPointerDownCapture={onActivate}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.repeat || event.nativeEvent.isComposing) {
          return;
        }
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.closest("[data-quiz-answer]")) {
          return;
        }
        event.preventDefault();
        if (target instanceof HTMLInputElement) {
          const index = blankRefs.current.indexOf(target);
          if (index >= 0 && index < blanks - 1) {
            blankRefs.current[index + 1]?.focus();
            return;
          }
        }
        onAdvance();
      }}
    >
      <span className="w-7 shrink-0 text-right font-heading text-[1.05rem] leading-8 font-semibold tabular-nums">
        {number}.
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {kicker}
        <div
          id={`${question.id}-stem`}
          data-quiz-answer={inlineBlanks ? "" : undefined}
          inert={inlineBlanks && !!grade}
          className="font-heading text-[1.05rem] leading-8 whitespace-pre-wrap"
        >
          {inlineBlanks
            ? stemParts.flatMap((part, index) =>
                index === 0 ? [part] : [blankInput(index - 1), part],
              )
            : question.stem}
          {points !== undefined ? (
            <span className="ml-1.5 font-sans text-sm text-muted-foreground">
              {tPaper("questionPoints", { points })}
            </span>
          ) : null}
        </div>
        {question.imageUrl ? (
          <img
            src={question.imageUrl}
            alt={tReview("handwritten")}
            className="max-h-80 rounded-lg border border-border/70 bg-muted/30 object-contain"
          />
        ) : null}
        {question.type === "fill_blank" && !inlineBlanks ? (
          <div data-quiz-answer="" inert={!!grade}>
            {Array.from({ length: blanks }).map((_, index) => blankInput(index))}
          </div>
        ) : null}
        {question.type === "mcq" || question.type === "image" ? (
          <RadioGroup
            data-quiz-answer=""
            inert={!!grade}
            aria-labelledby={`${question.id}-stem`}
            className={cn("gap-x-6 gap-y-0.5", shortOptions && "sm:grid-cols-2")}
            value={typeof response?.index === "number" ? String(response.index) : ""}
            onValueChange={(value) => onAnswer({ index: Number(value) })}
            onKeyDownCapture={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              if (order.length === 0) {
                return;
              }
              const selectedPosition =
                typeof response?.index === "number" ? order.indexOf(response.index) : -1;
              const nextPosition =
                selectedPosition < 0
                  ? event.key === "ArrowDown"
                    ? 0
                    : order.length - 1
                  : (selectedPosition + (event.key === "ArrowDown" ? 1 : -1) + order.length) %
                    order.length;
              const nextIndex = order[nextPosition];
              if (typeof nextIndex === "number") {
                onAnswer({ index: nextIndex });
                optionRefs.current[nextIndex]?.focus();
              }
            }}
          >
            {order.map((optionIndex, displayIndex) => {
              const option = sourceOptions[optionIndex];
              const selected = response?.index === optionIndex;
              const optionId = `${question.id}-option-${optionIndex}`;
              const isRight = grade?.correctAnswer?.index === optionIndex;
              return (
                <Label key={optionId} htmlFor={optionId} className={cn(optionRowClass, "mb-0")}>
                  <RadioGroupItem
                    ref={(element) => {
                      optionRefs.current[optionIndex] = element;
                    }}
                    value={String(optionIndex)}
                    id={optionId}
                    className="sr-only"
                  />
                  <Bubble selected={selected}>
                    {String.fromCharCode(65 + displayIndex)}
                    {isRight ? circle : null}
                  </Bubble>
                  <span
                    className={cn(
                      "flex-1",
                      grade &&
                        selected &&
                        !isRight &&
                        "line-through decoration-destructive decoration-2",
                    )}
                  >
                    {option}
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
        ) : null}
        {question.type === "true_false" ? (
          <div data-quiz-answer="" inert={!!grade} className="flex flex-wrap gap-x-10 gap-y-1">
            {[true, false].map((value, index) => {
              const selected = response?.value === value;
              const isRight = grade?.correctAnswer?.value === value;
              return (
                <button
                  key={String(value)}
                  ref={(element) => {
                    trueFalseRefs.current[index] = element;
                  }}
                  type="button"
                  aria-pressed={selected}
                  className={optionRowClass}
                  onClick={() => onAnswer({ value })}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowRight" ||
                      event.key === "ArrowUp" ||
                      event.key === "ArrowDown"
                    ) {
                      event.preventDefault();
                      const nextValue =
                        typeof response?.value === "boolean" ? !response.value : true;
                      onAnswer({ value: nextValue });
                      trueFalseRefs.current[nextValue ? 0 : 1]?.focus();
                    }
                  }}
                >
                  <Bubble selected={selected}>
                    {value ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    {isRight ? circle : null}
                  </Bubble>
                  <span
                    className={cn(
                      grade &&
                        selected &&
                        !isRight &&
                        "line-through decoration-destructive decoration-2",
                    )}
                  >
                    {value ? tReview("true") : tReview("false")}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {grade && !grade.isCorrect && question.type === "fill_blank" && correctBlanks.length > 0 ? (
          <PopMark as="p" order={markOrder} className="font-heading text-lg text-destructive italic">
            <span className="sr-only">{tReview("correctAnswer")} </span>→ {correctBlanks.join(", ")}
          </PopMark>
        ) : null}
        {grade?.explanation ? (
          <PopMark
            as="p"
            order={markOrder}
            className={cn(
              "border-l-2 pl-3 font-heading text-[0.95rem] leading-6 italic",
              grade.isCorrect
                ? "border-border text-muted-foreground"
                : "border-destructive/50 text-destructive/90",
            )}
          >
            {grade.explanation}
          </PopMark>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Badge variant="secondary">{categoryLabel}</Badge>
          {pointId && onToggleOmit ? (
            <OmitKnowledgePointButton
              knowledgePointId={pointId}
              isOmitted={isOmitted}
              onToggle={(omitted) => onToggleOmit(pointId, omitted)}
            />
          ) : null}
        </div>
        {children}
      </div>
      {grade ? (
        <span className="flex shrink-0 flex-col items-center text-destructive">
          <PenMark correct={grade.isCorrect} order={markOrder} />
          {!grade.isCorrect && points !== undefined ? (
            <PopMark order={markOrder} className="-rotate-6 font-heading text-lg font-semibold">
              −{points}
            </PopMark>
          ) : null}
          <span className="sr-only">{grade.isCorrect ? tReview("correct") : tReview("wrong")}</span>
        </span>
      ) : null}
    </Root>
  );
}

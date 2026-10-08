"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, type Category, type UiLocale } from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import { CtaIcon } from "@tmr/ui/components/cta-icon";
import { cn } from "@tmr/ui/utils";
import { MarksStart, ScoreStamp } from "@/spa/components/quiz/marks";
import {
  isAnswered,
  QuestionSheetItem,
  type QuestionGrade,
} from "@/spa/components/quiz/question-sheet-item";
import type { LocalResponse } from "@/spa/components/quiz/types";
import {
  normalizeBlank,
  SAMPLE_QUESTIONS,
  type SampleQuestion,
} from "./questions";

type Entry = {
  response?: LocalResponse;
  grade?: QuestionGrade;
  /** Confetti thrown for this correct answer. */
  burst?: Piece[];
};

type Piece = {
  x: number;
  y: number;
  rotate: number;
  delay: number;
  colour: string;
  round: boolean;
};

const CONFETTI_COLOURS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--chart-2)",
  "var(--chart-4)",
];

function grade(question: SampleQuestion, response: LocalResponse): QuestionGrade {
  let isCorrect = false;
  if (question.type === "fill_blank") {
    const typed = normalizeBlank(response.blanks?.[0] ?? "");
    isCorrect = (question.accept ?? []).some(
      (answer) => normalizeBlank(answer) === typed,
    );
  } else if (question.type === "true_false") {
    isCorrect = response.value === question.correctAnswer?.value;
  } else {
    isCorrect = response.index === question.correctAnswer?.index;
  }
  return {
    questionId: question.id,
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  };
}

/** A handful of paper scraps flung up and out, falling back under gravity. */
function throwConfetti(): Piece[] {
  return Array.from({ length: 28 }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 80 + Math.random() * 110;
    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
      rotate: (Math.random() - 0.5) * 900,
      delay: Math.random() * 0.08,
      colour: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length]!,
      round: index % 4 === 0,
    };
  });
}

function Confetti({ pieces }: { pieces: Piece[] }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-12 z-20"
    >
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          className={cn(
            "absolute block",
            piece.round ? "size-2 rounded-full" : "h-2.5 w-1.5 rounded-[1px]",
          )}
          style={{ backgroundColor: piece.colour }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.5 }}
          animate={{
            x: [0, piece.x, piece.x * 1.2],
            y: [0, piece.y, piece.y + 140],
            rotate: piece.rotate,
            opacity: [1, 1, 0],
            scale: 1,
          }}
          transition={{
            duration: 1.3,
            delay: 0.12 + piece.delay,
            times: [0, 0.35, 1],
            ease: "easeOut",
          }}
        />
      ))}
    </span>
  );
}

/**
 * Three sample questions on the homepage, one of each form, marked with the
 * same red pen as a real quiz. A right answer throws confetti; a wrong one
 * gets crossed out and corrected, then can be tried again.
 */
export function SampleReview({
  locale,
  ctaHref,
}: {
  locale: UiLocale;
  ctaHref: string;
}) {
  const t = useTranslations("Home.sample");
  const tCategory = useTranslations("Category");
  const questions = SAMPLE_QUESTIONS[locale];
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const correct = questions.filter(
    (question) => entries[question.id]?.grade?.isCorrect,
  ).length;
  const allCorrect = correct === questions.length;

  function update(id: string, next: Entry) {
    setEntries((current) => ({ ...current, [id]: next }));
  }

  function check(question: SampleQuestion) {
    const response = entries[question.id]?.response;
    if (!response || !isAnswered(question, response)) {
      return;
    }
    const result = grade(question, response);
    update(question.id, {
      response,
      grade: result,
      burst: result.isCorrect ? throwConfetti() : undefined,
    });
  }

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden translate-x-2 translate-y-2 rotate-[1.5deg] sm:block rounded-md border border-border bg-card"
      />
      <article className="relative rounded-md border border-t-4 border-border border-t-primary bg-card shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.05),0_18px_50px_rgb(var(--shadow-colour)/0.1)]">
        <header className="flex items-end justify-between gap-4 border-b border-border/70 px-5 pt-5 pb-4 sm:px-8">
          <div>
            <p className="eyebrow">{t("paperKicker")}</p>
            <h3 className="mt-1 font-heading text-xl font-semibold">
              {t("paperTitle")}
            </h3>
          </div>
          <p
            aria-live="polite"
            className="shrink-0 text-sm text-muted-foreground tabular-nums"
          >
            {t("progress", { done: correct, total: questions.length })}
          </p>
        </header>
        <MarksStart value={0.05}>
          <ol className="space-y-9 px-4 pt-6 pb-8 sm:px-8">
            {questions.map((question, index) => {
              const entry = entries[question.id] ?? {};
              const right = entry.grade?.isCorrect === true;
              return (
                <QuestionSheetItem
                  key={question.id}
                  ref={() => {}}
                  question={question}
                  number={index + 1}
                  isLast={index === questions.length - 1}
                  response={entry.response}
                  optionOrder={undefined}
                  categoryLabel={
                    CATEGORIES.includes(question.category as Category)
                      ? tCategory(question.category as Category)
                      : question.category
                  }
                  pointId={undefined}
                  isOmitted={false}
                  grade={entry.grade}
                  markOrder={1}
                  onAnswer={(response) => update(question.id, { response })}
                  onActivate={() => {}}
                  onAdvance={() => {
                    if (!entry.grade) {
                      check(question);
                    }
                  }}
                >
                  <div className="relative flex min-h-9 flex-wrap items-center gap-3">
                    {!entry.grade ? (
                      <Button
                        size="sm"
                        disabled={!isAnswered(question, entry.response)}
                        onClick={() => check(question)}
                      >
                        <CtaIcon kind="submit" />
                        {t("check")}
                      </Button>
                    ) : right ? (
                      <ScoreStamp
                        after={1}
                        className="rounded-[0.3rem] border-2 border-success/80 px-2.5 py-0.5 font-heading font-semibold tracking-[0.08em] text-success"
                      >
                        {t("correct")}
                      </ScoreStamp>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => update(question.id, {})}
                        >
                          <CtaIcon kind="retake" />
                          {t("tryAgain")}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {t("wrongHint")}
                        </span>
                      </>
                    )}
                    {entry.burst ? <Confetti pieces={entry.burst} /> : null}
                  </div>
                </QuestionSheetItem>
              );
            })}
          </ol>
        </MarksStart>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-4 sm:px-8">
          <p className="text-sm text-muted-foreground">
            {allCorrect ? (
              <span className="font-medium text-foreground">
                {t("doneTitle")}
              </span>
            ) : null}{" "}
            {t("footnote")}
          </p>
          <Button
            asChild
            size="sm"
            variant={allCorrect ? "default" : "ghost"}
            className="shrink-0"
          >
            <a href={ctaHref}>
              {t("cta")}
              <ArrowRight />
            </a>
          </Button>
        </footer>
      </article>
    </div>
  );
}

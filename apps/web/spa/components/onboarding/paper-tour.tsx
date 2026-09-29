import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "use-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  CATEGORIES,
  DEMO_PAPERS,
  PAPER_POINTS,
  gradeAnswer,
  paperParts,
  partNumeral,
  toUiLocale,
  type Category,
  type DemoQuestion,
  type LanguageCode,
} from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import { Progress } from "@tmr/ui/components/progress";
import { cn } from "@tmr/ui/utils";
import { LAST_MARK, PopMark, ScoreStamp } from "@/spa/components/quiz/marks";
import { QuestionSheetItem, type QuestionGrade } from "@/spa/components/quiz/question-sheet-item";
import { HandInSheet } from "@/spa/components/quiz/quiz-runner";
import type { LocalResponse } from "@/spa/components/quiz/types";

/** Each stop of the tour, and the part of the paper it points at. */
const TOUR = [
  { key: "header", target: "header" },
  { key: "choice", target: "choice" },
  { key: "trueFalse", target: "true_false" },
  { key: "fillBlank", target: "fill_blank" },
  { key: "bar", target: "bar" },
  { key: "marks", target: "marks" },
  { key: "score", target: "score" },
] as const;

/** The first stop that shows the paper marked. */
const GRADED_FROM = 5;
/** How many questions the sample student has answered by each stop. */
const ANSWERED_BY = [0, 2, 3, 4, 4, 4, 4];
/** How long the sheet takes to fly off before the marked copy drops back, as in the runner. */
const HAND_IN_MS = 700;
/** Room kept under the paper for the coach card fixed to the bottom of the screen. */
const COACH_ROOM = 220;

type Box = { top: number; left: number; width: number; height: number };

function characters(text: string) {
  return Array.from(text);
}

/** What the sample student has written on a question so far. */
function responseFor(question: DemoQuestion, answered: boolean, typed: number): LocalResponse | undefined {
  if (!answered) {
    return undefined;
  }
  if (question.type === "fill_blank") {
    const written = question.response.blanks?.[0] ?? "";
    return { blanks: [characters(written).slice(0, typed).join("")] };
  }
  return question.response;
}

export function PaperTour({
  language,
  languageName,
  onBack,
  onDone,
}: {
  language: LanguageCode;
  languageName: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("Onboarding.Tour");
  const tPaper = useTranslations("Quiz.Paper");
  const tRunner = useTranslations("Quiz.Runner");
  const tLayout = useTranslations("Layout");
  const categoryT = useTranslations("Category");
  const locale = useLocale();
  const uiLocale = toUiLocale(locale);
  const questions = DEMO_PAPERS[language].questions;
  const blankQuestion = questions.find((question) => question.type === "fill_blank");
  const blankLength = characters(blankQuestion?.response.blanks?.[0] ?? "").length;

  const [stop, setStop] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answered, setAnswered] = useState(0);
  const [typed, setTyped] = useState(0);
  const [handIn, setHandIn] = useState<"idle" | "out" | "back">("idle");
  const [box, setBox] = useState<Box | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // The sample student answers one question at a time, so each bubble visibly fills in.
  // Skipping ahead completes everything at once.
  const answeredTarget = ANSWERED_BY[stop] ?? 4;
  const complete = stop >= 4;
  useEffect(() => {
    if (answered >= answeredTarget) {
      return;
    }
    const timer = setTimeout(() => setAnswered((count) => count + 1), answered === 0 ? 450 : 340);
    return () => clearTimeout(timer);
  }, [answered, answeredTarget]);
  // The blank is written letter by letter once its question comes up.
  useEffect(() => {
    if (answered < 4 || typed >= blankLength) {
      return;
    }
    const timer = setTimeout(() => setTyped((count) => count + 1), typed === 0 ? 300 : 130);
    return () => clearTimeout(timer);
  }, [answered, typed, blankLength]);

  const graded = handIn === "back";
  const grades = new Map<string, QuestionGrade>(
    graded
      ? questions.map((question) => [
          question.id,
          {
            questionId: question.id,
            isCorrect: gradeAnswer(question.type, question.answer, question.response),
            correctAnswer: question.answer,
            explanation: question.explanation[uiLocale],
          },
        ])
      : [],
  );
  const parts = paperParts(questions, PAPER_POINTS);
  const fullMarks = parts.reduce((sum, part) => sum + part.totalPoints, 0);
  const earnedIn = (part: (typeof parts)[number]) =>
    part.questions.reduce(
      (sum, { question }) => sum + (grades.get(question.id)?.isCorrect ? part.pointsEach : 0),
      0,
    );
  const earnedTotal = parts.reduce((sum, part) => sum + earnedIn(part), 0);
  const correctCount = questions.filter((question) => grades.get(question.id)?.isCorrect).length;
  const responses = questions.map((question, index) =>
    responseFor(question, complete || index < answered, complete ? blankLength : typed),
  );
  const answeredCount = responses.filter((response) => response !== undefined).length;
  const lastMark = Math.min(questions.length, LAST_MARK);
  const redMark = "font-heading font-semibold text-destructive";
  const numeral = (partNumber: number) => partNumeral(tPaper("numerals"), partNumber);
  const categoryLabel = (category: string) =>
    CATEGORIES.includes(category as Category) ? categoryT(category as Category) : category;
  const today = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date());

  // The spotlight follows whichever part of the paper the current stop is about.
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const target = stage?.querySelector<HTMLElement>(`[data-tour="${TOUR[stop]?.target}"]`);
    if (!stage || !target) {
      return null;
    }
    const base = stage.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const pad = 10;
    setBox({
      top: rect.top - base.top - pad,
      left: rect.left - base.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
    return rect;
  }, [stop]);

  const focusStop = useCallback(() => {
    const rect = measure();
    if (!rect) {
      return;
    }
    // Centre the target in the part of the screen the coach card leaves free.
    const room = window.innerHeight - COACH_ROOM;
    const offset = Math.max(24, (room - rect.height) / 2);
    window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: "smooth" });
  }, [measure]);

  useLayoutEffect(focusStop, [focusStop]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // The marked copy lands after its drop; find the red pen again once it has settled.
  useEffect(() => {
    if (handIn !== "back") {
      return;
    }
    const timer = setTimeout(focusStop, 900);
    return () => clearTimeout(timer);
  }, [handIn, focusStop]);

  const next = useCallback(() => {
    if (stop >= TOUR.length - 1) {
      onDone();
      return;
    }
    setDirection(1);
    setStop(stop + 1);
    // Reaching the marks hands the paper in; it flies off and drops back marked.
    if (stop + 1 === GRADED_FROM) {
      setHandIn("out");
      setTimeout(() => setHandIn((phase) => (phase === "out" ? "back" : phase)), HAND_IN_MS);
    }
  }, [stop, onDone]);

  const back = useCallback(() => {
    if (stop === 0) {
      onBack();
      return;
    }
    setDirection(-1);
    setStop(stop - 1);
    if (stop - 1 < GRADED_FROM) {
      setHandIn("idle");
    }
  }, [stop, onBack]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        next();
      } else if (event.key === "ArrowLeft") {
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  const current = TOUR[stop] ?? TOUR[0];
  const isLast = stop === TOUR.length - 1;

  return (
    <div className="mx-auto w-full max-w-3xl" style={{ paddingBottom: COACH_ROOM }}>
      <div ref={stageRef} className="relative">
        {/* The sample paper is only for looking at; the tour fills it in. */}
        <div inert className="space-y-5 select-none">
          <HandInSheet
            key={graded ? "marked" : "sheet"}
            submitting={handIn === "out"}
            handedBack={graded}
            className="quiz-paper-stack"
          >
            <article className="quiz-paper">
              <header data-tour="header" className="px-6 pt-8 sm:px-12 sm:pt-10">
                <p className="eyebrow text-center">{tLayout("title")}</p>
                <h2 className="mt-3 text-center font-heading text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  {t("paperTitle", { language: languageName })}
                </h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">{today}</p>
                <div className="mt-6 flex flex-col gap-4 border-b-[3px] border-double border-foreground/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1 text-sm">
                    {graded ? (
                      <PopMark as="p" className="font-heading text-base text-destructive italic">
                        {tRunner("reviewMissed")}
                      </PopMark>
                    ) : (
                      <p className="text-muted-foreground">{t("instructions")}</p>
                    )}
                    <p className="text-muted-foreground">
                      {tPaper("fullMarks", { total: fullMarks })}
                      {" · "}
                      {tPaper("suggestedTime", { minutes: 5 })}
                    </p>
                  </div>
                  <table
                    data-tour="score"
                    className="shrink-0 border-collapse self-start text-center text-sm sm:self-auto"
                  >
                    <thead>
                      <tr>
                        <th className="border border-foreground/60 px-2.5 py-1 font-medium">
                          {tPaper("partHeader")}
                        </th>
                        {parts.map((part) => (
                          <th
                            key={part.section}
                            className="border border-foreground/60 px-2.5 py-1 font-heading font-medium"
                          >
                            {numeral(part.partNumber)}
                          </th>
                        ))}
                        <th className="border border-foreground/60 px-2.5 py-1 font-medium">
                          {tPaper("totalHeader")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th className="border border-foreground/60 px-2.5 py-1 font-medium">
                          {tRunner("scoreLabel")}
                        </th>
                        {parts.map((part) => (
                          <td key={part.section} className="h-11 min-w-11 border border-foreground/60">
                            {graded ? (
                              <PopMark order={lastMark} className={cn(redMark, "text-lg")}>
                                {earnedIn(part)}
                              </PopMark>
                            ) : null}
                          </td>
                        ))}
                        <td className="h-11 min-w-14 border border-foreground/60">
                          {graded ? (
                            <ScoreStamp after={lastMark} className={cn(redMark, "text-2xl")}>
                              {earnedTotal}
                            </ScoreStamp>
                          ) : null}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </header>
              <div className="space-y-10 px-6 pt-8 pb-10 sm:px-12">
                {parts.map((part) => (
                  <section key={part.section} data-tour={part.section}>
                    <h3 className="flex flex-wrap items-baseline gap-x-2 font-heading text-lg font-semibold">
                      {tPaper("part", {
                        numeral: numeral(part.partNumber),
                        title: tPaper(part.section),
                      })}
                      <span className="text-sm font-normal text-muted-foreground">
                        {tPaper("partInfo", {
                          count: part.questions.length,
                          points: part.pointsEach,
                          total: part.totalPoints,
                        })}
                      </span>
                      {graded ? (
                        <PopMark order={lastMark} className={cn(redMark, "ml-1 -rotate-6 text-xl")}>
                          {earnedIn(part)}
                        </PopMark>
                      ) : null}
                    </h3>
                    <ol className="mt-5 space-y-9">
                      {part.questions.map(({ question, number }) => {
                        const grade = grades.get(question.id);
                        return (
                          <QuestionSheetItem
                            key={question.id}
                            ref={(element) => {
                              // The one wrong answer is where the tour shows the red pen.
                              if (element && grade && !grade.isCorrect) {
                                element.dataset.tour = "marks";
                              }
                            }}
                            question={{ ...question, position: number }}
                            number={number}
                            points={part.pointsEach}
                            isLast={number === questions.length}
                            response={responses[number - 1]}
                            optionOrder={undefined}
                            categoryLabel={categoryLabel(question.category)}
                            pointId={undefined}
                            isOmitted={false}
                            grade={grade}
                            markOrder={number}
                            onAnswer={() => undefined}
                            onActivate={() => undefined}
                            onAdvance={() => undefined}
                          />
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            </article>
          </HandInSheet>
          <div
            data-tour="bar"
            className="flex items-center gap-2 rounded-2xl border border-border/75 bg-background/85 p-2 pl-4 shadow-[0_10px_36px_rgb(var(--shadow-colour)/0.1)]"
          >
            {graded ? (
              <p className="min-w-0 flex-1 py-2 text-sm font-medium">
                {t("scoreLine", { correct: correctCount, total: questions.length })}
              </p>
            ) : (
              <>
                <div className="mr-2 min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("answered", { answered: answeredCount, total: questions.length })}
                  </p>
                  <Progress className="mt-1.5" value={(answeredCount / questions.length) * 100} />
                </div>
                <Button
                  tabIndex={-1}
                  className={cn(current.key === "bar" && "motion-safe:animate-pulse")}
                >
                  {t("submit")}
                </Button>
              </>
            )}
          </div>
        </div>

        {box ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-2xl ring-2 ring-primary/55"
            style={{
              boxShadow: "0 0 0 200vmax color-mix(in oklch, var(--background) 62%, transparent)",
            }}
            initial={false}
            animate={{ ...box, opacity: handIn === "out" ? 0 : 1 }}
            transition={{ type: "spring", stiffness: 210, damping: 28 }}
          />
        ) : null}
      </div>

      <motion.aside
        role="dialog"
        aria-live="polite"
        aria-label={t(`${current.key}.title`)}
        layout
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[0_24px_60px_-12px_rgb(var(--shadow-colour)/0.35)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{t("progress", { current: stop + 1, total: TOUR.length })}</p>
          <div className="flex gap-1" aria-hidden="true">
            {TOUR.map((entry, index) => (
              <motion.span
                key={entry.key}
                className="h-1.5 rounded-full bg-primary"
                initial={false}
                animate={{ width: index === stop ? 16 : 6, opacity: index <= stop ? 1 : 0.2 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            ))}
          </div>
        </div>
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={current.key}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <h2 className="mt-2 font-heading text-xl font-semibold tracking-[-0.02em]">
              {t(`${current.key}.title`)}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t(`${current.key}.body`)}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={onDone}>
            {t("skipPart")}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="icon" aria-label={t("back")} onClick={back}>
              <ArrowLeft />
            </Button>
            <Button onClick={next} className="group">
              {isLast ? t("finish") : t("next")}
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

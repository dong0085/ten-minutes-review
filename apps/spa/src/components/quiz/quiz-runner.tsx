
import { Link } from "react-router";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Check, Loader2, Printer, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIES,
  EXAM_POINTS,
  PAPER_POINTS,
  isIndexOrder,
  paperOrder,
  paperParts,
  partNumeral,
  shuffledIndexOrder,
  type Category,
} from "@tmr/core";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@tmr/ui/components/dialog";
import { Label } from "@tmr/ui/components/label";
import { Progress } from "@tmr/ui/components/progress";
import { RadioGroup, RadioGroupItem } from "@tmr/ui/components/radio-group";
import { Skeleton } from "@tmr/ui/components/skeleton";
import { cn } from "@tmr/ui/utils";
import {
  clearQuizDraft,
  loadQuizDraft,
  loadQuizOptionOrders,
  saveQuizDraft,
  saveQuizOptionOrders,
  type QuizOptionOrders,
} from "@/lib/quiz-draft";
import type { AnswerShape } from "./question-review";
import { OmitKnowledgePointButton } from "./omit-knowledge-point-button";
import { Scantron } from "./scantron";
import type { LocalResponse, QuizQuestion } from "./types";

type QuestionGrade = {
  questionId: string;
  knowledgePointId?: string;
  isKnowledgePointRetired?: boolean;
  isCorrect: boolean;
  correctAnswer: AnswerShape;
  explanation: string;
};

type SubmitResult = {
  attemptId: string;
  correctCount: number;
  questionCount: number;
  results: QuestionGrade[];
};

/** How long the sheet takes to fly off before the graded copy can drop back in. */
const HAND_IN_MS = 700;

function blankCount(stem: string): number {
  const matches = stem.match(/_{2,}/g);
  return Math.max(1, matches?.length ?? 0);
}

function emptyResponse(question: QuizQuestion): LocalResponse {
  if (question.type === "fill_blank") {
    return { blanks: Array.from({ length: blankCount(question.stem) }, () => "") };
  }
  if (question.type === "true_false") {
    return { value: null };
  }
  return { index: null };
}

function isAnswered(question: QuizQuestion, response: LocalResponse | undefined): boolean {
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

function buildOptionOrders(
  questions: QuizQuestion[],
  restored: QuizOptionOrders = {},
  previous: QuizOptionOrders = {},
): QuizOptionOrders {
  return Object.fromEntries(
    questions
      .filter((question) => question.type === "mcq" || question.type === "image")
      .map((question) => {
        const count = question.options?.length ?? 0;
        const restoredOrder = restored[question.id];
        return [
          question.id,
          isIndexOrder(restoredOrder, count)
            ? restoredOrder
            : shuffledIndexOrder(count, previous[question.id]),
        ];
      }),
  );
}

class ApiRequestError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function readError(response: Response): Promise<ApiRequestError | null> {
  const data: unknown = await response.json().catch(() => null);
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string") {
      const code = (data as { code?: unknown }).code;
      return new ApiRequestError(message, typeof code === "string" ? code : undefined);
    }
  }
  return null;
}

export function QuizRunner({
  quizId,
  classroomId,
  userId,
  title,
  subtitle,
  instructions,
  suggestedMinutes,
  kind = "daily",
  candidateName = "",
}: {
  quizId: string;
  classroomId: string;
  userId: string;
  title: string;
  subtitle: string;
  instructions: string;
  suggestedMinutes?: number;
  kind?: "daily" | "manual" | "exam";
  candidateName?: string;
}) {
  const isExam = kind === "exam";
  const t = useTranslations("Quiz.Runner");
  const tLayout = useTranslations("Layout");
  const tPaper = useTranslations("Quiz.Paper");
  const categoryT = useTranslations("Category");
  const categoryLabel = (category: string) =>
    CATEGORIES.includes(category as Category) ? categoryT(category as Category) : category;
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attemptToken, setAttemptToken] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, LocalResponse>>({});
  const [optionOrders, setOptionOrders] = useState<QuizOptionOrders>({});
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<"loading" | "taking" | "submitting" | "results" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [handedBack, setHandedBack] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [omittedPointIds, setOmittedPointIds] = useState<Set<string>>(new Set());
  // Pencil marks rubbed out on the answer sheet, as "questionId:choice".
  const [erased, setErased] = useState<Set<string>>(new Set());
  const startedAt = useRef(0);
  const questionStartedAt = useRef(0);
  const durations = useRef<Record<string, number>>({});
  const hasStarted = useRef(false);
  const questionRefs = useRef<Record<string, HTMLElement | null>>({});
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const scrollToRestored = useRef(false);

  const handleToggleOmit = useCallback((pointId: string, omitted: boolean) => {
    setOmittedPointIds((prev) => {
      const next = new Set(prev);
      if (omitted) {
        next.add(pointId);
      } else {
        next.delete(pointId);
      }
      return next;
    });
  }, []);

  const startAttempt = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setResult(null);
    setHandedBack(false);
    setResponses({});
    setOptionOrders({});
    setQuestions([]);
    setOmittedPointIds(new Set());
    setErased(new Set());
    setCurrent(0);
    durations.current = {};
    try {
      const draft = loadQuizDraft(userId, quizId);
      if (draft) {
        const response = await fetch(`/api/quizzes/${quizId}`);
        if (!response.ok) {
          throw (await readError(response)) ?? new ApiRequestError(t("startError"));
        }
        const data = (await response.json()) as { quiz: { questions: QuizQuestion[] } };
        const restoredQuestions = paperOrder(data.quiz.questions);
        const restoredOptionOrders = buildOptionOrders(
          restoredQuestions,
          draft.optionOrders,
          loadQuizOptionOrders(userId, quizId),
        );
        const initialOmitted = new Set<string>();
        for (const question of restoredQuestions) {
          if (question.knowledgePointId && question.isKnowledgePointRetired) {
            initialOmitted.add(question.knowledgePointId);
          }
        }
        setOmittedPointIds(initialOmitted);
        setAttemptToken(draft.attemptToken);
        setQuestions(restoredQuestions);
        setOptionOrders(restoredOptionOrders);
        saveQuizOptionOrders(userId, quizId, restoredOptionOrders);
        setResponses(draft.responses);
        setErased(new Set(draft.erased ?? []));
        setCurrent(Math.max(0, Math.min(draft.current, restoredQuestions.length - 1)));
        scrollToRestored.current = draft.current > 0;
        durations.current = draft.durations;
        startedAt.current = draft.startedAt;
        questionStartedAt.current = draft.questionStartedAt;
        setPhase("taking");
        return;
      }
      const response = await fetch(`/api/quizzes/${quizId}/attempts`, { method: "POST" });
      if (!response.ok) {
        throw (await readError(response)) ?? new ApiRequestError(t("startError"));
      }
      const data = (await response.json()) as { attemptToken: string; questions: QuizQuestion[] };
      data.questions = paperOrder(data.questions);
      const nextOptionOrders = buildOptionOrders(
        data.questions,
        {},
        loadQuizOptionOrders(userId, quizId),
      );
      const initialOmitted = new Set<string>();
      for (const question of data.questions) {
        if (question.knowledgePointId && question.isKnowledgePointRetired) {
          initialOmitted.add(question.knowledgePointId);
        }
      }
      setOmittedPointIds(initialOmitted);
      setAttemptToken(data.attemptToken);
      setQuestions(data.questions);
      setOptionOrders(nextOptionOrders);
      saveQuizOptionOrders(userId, quizId, nextOptionOrders);
      const now = Date.now();
      startedAt.current = now;
      questionStartedAt.current = now;
      setPhase("taking");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t("startError"));
      setPhase("error");
    }
  }, [quizId, userId, t]);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    void startAttempt();
  }, [startAttempt]);

  const trackTime = useCallback((questionId: string) => {
    const now = Date.now();
    durations.current[questionId] =
      (durations.current[questionId] ?? 0) + (now - questionStartedAt.current);
    questionStartedAt.current = now;
  }, []);

  // Every question is on the page, so time goes to whichever one the learner last touched.
  const activate = useCallback(
    (index: number) => {
      if (index === current) {
        return;
      }
      const activeQuestion = questions[current];
      if (activeQuestion) {
        trackTime(activeQuestion.id);
      }
      setCurrent(index);
    },
    [current, questions, trackTime],
  );

  const setAnswer = (questionId: string, response: LocalResponse) => {
    const before = responses[questionId]?.index ?? responses[questionId]?.value;
    const after = response.index ?? response.value;
    if (before !== undefined && before !== null && before !== after) {
      setErased((previous) => new Set(previous).add(`${questionId}:${String(before)}`));
    }
    setResponses((previous) => ({ ...previous, [questionId]: response }));
  };

  useEffect(() => {
    if (phase !== "taking" || !attemptToken) {
      return;
    }
    saveQuizDraft(userId, quizId, {
      version: 1,
      attemptToken,
      startedAt: startedAt.current,
      questionStartedAt: questionStartedAt.current,
      responses,
      current,
      durations: durations.current,
      optionOrders,
      erased: [...erased],
      savedAt: Date.now(),
    });
  }, [attemptToken, current, erased, optionOrders, phase, quizId, responses, userId]);

  useEffect(() => {
    if (phase !== "taking" || !scrollToRestored.current) {
      return;
    }
    scrollToRestored.current = false;
    const question = questions[current];
    if (question) {
      questionRefs.current[question.id]?.scrollIntoView({ block: "center" });
    }
  }, [current, phase, questions]);

  const submit = useCallback(async () => {
    if (!attemptToken || questions.length === 0) {
      return;
    }
    const activeQuestion = questions[current];
    if (activeQuestion) {
      trackTime(activeQuestion.id);
    }
    setPhase("submitting");
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const handedIn = new Promise((resolve) => setTimeout(resolve, HAND_IN_MS));
    const durationMs = Date.now() - startedAt.current;
    try {
      const response = await fetch("/api/attempts/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptToken,
          durationMs,
          responses: questions.map((question) => ({
            questionId: question.id,
            response: responses[question.id] ?? emptyResponse(question),
            durationMs: durations.current[question.id] ?? undefined,
          })),
        }),
      });
      if (!response.ok) {
        throw (await readError(response)) ?? new ApiRequestError(t("submitError"));
      }
      const data = (await response.json()) as SubmitResult;
      clearQuizDraft(userId, quizId);
      await handedIn;
      setResult(data);
      setElapsedMs(durationMs);
      setHandedBack(true);
      setPhase("results");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("submitError");
      if (submitError instanceof ApiRequestError && submitError.code === "attempt_invalid") {
        clearQuizDraft(userId, quizId);
      }
      await handedIn;
      setError(message);
      setHandedBack(true);
      setPhase("taking");
      toast.error(message);
    }
  }, [attemptToken, current, questions, quizId, responses, t, trackTime, userId]);

  const focusQuestion = useCallback((questionId: string) => {
    const container = questionRefs.current[questionId];
    const target =
      container?.querySelector<HTMLElement>(
        '[data-quiz-answer] [data-state="checked"], [data-quiz-answer] [aria-pressed="true"]',
      ) ?? container?.querySelector<HTMLElement>("[data-quiz-answer] :is(input, button)");
    target?.focus({ preventScroll: true });
    container?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  const advance = useCallback(
    (index: number) => {
      const nextQuestion = questions[index + 1];
      if (!nextQuestion) {
        submitRef.current?.focus();
        return;
      }
      focusQuestion(nextQuestion.id);
    },
    [focusQuestion, questions],
  );

  if (phase === "loading") {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardContent className="space-y-5 py-4">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardContent className="space-y-3">
          <Alert variant="destructive">
            <AlertDescription>{error ?? t("startError")}</AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startAttempt()}>{t("tryAgain")}</Button>
            <Button asChild variant="outline">
              <Link to={`/classrooms/${classroomId}/quizzes`}>{t("backToQuizzes")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const graded = phase === "results" && result ? result : null;
  const gradeFor = (questionId: string) =>
    graded?.results.find((entry) => entry.questionId === questionId);
  const answeredCount = questions.filter((question) =>
    isAnswered(question, responses[question.id]),
  ).length;
  const parts = paperParts(questions, isExam ? EXAM_POINTS : PAPER_POINTS);
  const fullMarks = parts.reduce((sum, part) => sum + part.totalPoints, 0);
  const earnedIn = (part: (typeof parts)[number]) =>
    part.questions.reduce(
      (sum, { question }) => sum + (gradeFor(question.id)?.isCorrect ? part.pointsEach : 0),
      0,
    );
  const earnedTotal = parts.reduce((sum, part) => sum + earnedIn(part), 0);
  const numeral = (partNumber: number) => partNumeral(tPaper("numerals"), partNumber);
  const redMark = "quiz-mark font-heading font-semibold text-destructive";
  const sheetMotion =
    phase === "submitting"
      ? "quiz-sheet-hand-in pointer-events-none"
      : handedBack
        ? "quiz-sheet-hand-back"
        : undefined;
  const scantron = isExam ? (
    <Scantron
      seed={quizId}
      candidateName={candidateName}
      subject={title}
      date={subtitle}
      parts={parts}
      responses={responses}
      optionOrders={optionOrders}
      erased={erased}
      grades={
        graded
          ? new Map(graded.results.map((entry) => [entry.questionId, entry]))
          : null
      }
      earned={graded ? earnedTotal : null}
      activeQuestionId={questions[current]?.id ?? null}
      onAnswer={(questionId, next) => {
        const index = questions.findIndex((question) => question.id === questionId);
        if (index >= 0) {
          activate(index);
        }
        setAnswer(questionId, next);
      }}
      onJump={focusQuestion}
    />
  ) : null;

  return (
    <div
      data-wide={isExam || undefined}
      className={cn(
        "relative mx-auto",
        isExam
          ? "grid max-w-6xl gap-8 lg:grid-cols-[23rem_minmax(0,1fr)] lg:items-start"
          : "max-w-3xl",
      )}
    >
      {scantron ? (
        <aside
          key={graded ? `${graded.attemptId}-card` : "card"}
          className={cn(
            "hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-1 print:hidden",
            sheetMotion,
          )}
        >
          {scantron}
        </aside>
      ) : null}
      <div className="relative min-w-0 space-y-5">
      {phase === "submitting" ? (
        <div
          role="status"
          className="absolute inset-x-0 top-16 z-10 flex justify-center print:hidden motion-safe:animate-in motion-safe:fade-in motion-safe:delay-300 motion-safe:fill-mode-both"
        >
          <span className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            {t("grading")}
          </span>
        </div>
      ) : null}
      {error && phase === "taking" ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div
        key={graded ? graded.attemptId : "sheet"}
        className={cn("quiz-paper-stack", sheetMotion)}
      >
        <article className="quiz-paper">
          <header className="px-6 pt-8 sm:px-12 sm:pt-10">
            <p className="eyebrow text-center">{tLayout("title")}</p>
            <h2 className="mt-3 text-center font-heading text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-6 flex flex-col gap-4 border-b-[3px] border-double border-foreground/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1 text-sm">
                <p
                  className={cn(
                    graded
                      ? "quiz-mark font-heading text-base text-destructive italic"
                      : "text-muted-foreground",
                  )}
                >
                  {graded
                    ? graded.correctCount === graded.questionCount
                      ? t("everyAnswerLanded")
                      : t("reviewMissed")
                    : instructions}
                </p>
                <p className="text-muted-foreground">
                  {tPaper("fullMarks", { total: fullMarks })}
                  {graded ? (
                    <>
                      {" · "}
                      {tPaper("timeTaken", {
                        minutes: Math.floor(elapsedMs / 60000),
                        seconds: Math.floor((elapsedMs % 60000) / 1000),
                      })}
                    </>
                  ) : suggestedMinutes ? (
                    <>
                      {" · "}
                      {tPaper("suggestedTime", { minutes: suggestedMinutes })}
                    </>
                  ) : null}
                </p>
              </div>
              <table className="shrink-0 border-collapse self-start text-center text-sm sm:self-auto">
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
                      {t("scoreLabel")}
                    </th>
                    {parts.map((part) => (
                      <td key={part.section} className="h-11 min-w-11 border border-foreground/60">
                        {graded ? <span className={cn(redMark, "text-lg")}>{earnedIn(part)}</span> : null}
                      </td>
                    ))}
                    <td className="h-11 min-w-14 border border-foreground/60">
                      {graded ? (
                        <span className={cn(redMark, "inline-block -rotate-6 text-2xl")}>
                          {earnedTotal}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </header>
          <div className="space-y-10 px-6 pt-8 pb-10 sm:px-12">
            {parts.map((part) => (
              <section key={part.section} aria-labelledby={`part-${part.section}`}>
                <h3
                  id={`part-${part.section}`}
                  className="flex flex-wrap items-baseline gap-x-2 font-heading text-lg font-semibold"
                >
                  {tPaper("part", { numeral: numeral(part.partNumber), title: tPaper(part.section) })}
                  <span className="text-sm font-normal text-muted-foreground">
                    {tPaper("partInfo", {
                      count: part.questions.length,
                      points: part.pointsEach,
                      total: part.totalPoints,
                    })}
                  </span>
                  {graded ? (
                    <span className={cn(redMark, "ml-1 inline-block -rotate-6 text-xl")}>
                      {earnedIn(part)}
                    </span>
                  ) : null}
                </h3>
                <ol className="mt-5 space-y-9">
                  {part.questions.map(({ question, number }) => {
                    const index = number - 1;
                    const grade = gradeFor(question.id);
                    const pointId = question.knowledgePointId ?? grade?.knowledgePointId;
                    return (
                      <QuestionSheetItem
                        key={question.id}
                        ref={(element) => {
                          questionRefs.current[question.id] = element;
                        }}
                        question={question}
                        number={number}
                        points={part.pointsEach}
                        isLast={index === questions.length - 1}
                        response={responses[question.id]}
                        optionOrder={optionOrders[question.id]}
                        categoryLabel={categoryLabel(question.category)}
                        pointId={pointId}
                        isOmitted={
                          pointId
                            ? omittedPointIds.has(pointId)
                            : (grade?.isKnowledgePointRetired ?? false)
                        }
                        grade={grade}
                        markOrder={Math.min(number, 12)}
                        onToggleOmit={handleToggleOmit}
                        onAnswer={(next) => setAnswer(question.id, next)}
                        onActivate={() => activate(index)}
                        onAdvance={() => advance(index)}
                      />
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </article>
      </div>
      <div className="sticky bottom-3 z-20 flex items-center gap-2 print:hidden rounded-2xl border border-border/75 bg-background/85 p-2 pl-4 shadow-[0_10px_36px_rgb(var(--shadow-colour)/0.1)] backdrop-blur-xl">
        {graded ? (
          <>
            <p className="min-w-0 flex-1 text-sm font-medium">
              {t("score", { correct: graded.correctCount, total: graded.questionCount })}
            </p>
            {scantron ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("answerSheet")}>
                    <ScanLine />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] overflow-y-auto p-3 sm:max-w-md">
                  <DialogTitle className="sr-only">{t("answerSheet")}</DialogTitle>
                  {scantron}
                </DialogContent>
              </Dialog>
            ) : null}
            <Button variant="ghost" size="icon" aria-label={t("print")} onClick={() => window.print()}>
              <Printer />
            </Button>
            <Button variant="outline" onClick={() => void startAttempt()}>
              {t("retake")}
            </Button>
            <Button asChild variant="outline">
              <Link to={`/classrooms/${classroomId}/quizzes/${quizId}/attempts/${graded.attemptId}`}>
                {t("fullReview")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <div className="mr-2 min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t("answeredProgress", { answered: answeredCount, total: questions.length })}
              </p>
              <Progress
                className="mt-1.5"
                value={questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}
              />
            </div>
            {scantron ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("answerSheet")}>
                    <ScanLine />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] overflow-y-auto p-3 sm:max-w-md">
                  <DialogTitle className="sr-only">{t("answerSheet")}</DialogTitle>
                  {scantron}
                </DialogContent>
              </Dialog>
            ) : null}
            <Button variant="ghost" size="icon" aria-label={t("print")} onClick={() => window.print()}>
              <Printer />
            </Button>
            <Button
              ref={submitRef}
              onClick={() => void submit()}
              disabled={phase === "submitting"}
            >
              {phase === "submitting" ? <Loader2 className="animate-spin" /> : null}
              {phase === "submitting" ? t("submitting") : t("submit")}
            </Button>
          </>
        )}
      </div>
      </div>
    </div>
  );
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

function QuestionSheetItem({
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
}: {
  ref: (element: HTMLElement | null) => void;
  question: QuizQuestion;
  number: number;
  points: number;
  isLast: boolean;
  response: LocalResponse | undefined;
  optionOrder: number[] | undefined;
  categoryLabel: string;
  pointId: string | undefined;
  isOmitted: boolean;
  grade: QuestionGrade | undefined;
  markOrder: number;
  onToggleOmit: (pointId: string, omitted: boolean) => void;
  onAnswer: (response: LocalResponse) => void;
  onActivate: () => void;
  onAdvance: () => void;
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
  const markStyle = { "--mark-order": markOrder } as CSSProperties;
  const correctBlanks = (grade?.correctAnswer?.blanks ?? []).filter(
    (blank): blank is string => !!blank && blank.trim() !== "",
  );
  const shortOptions = sourceOptions.every((option) => option.length <= 28);
  // The teacher's red circle around the right choice.
  const circle = (
    <span
      aria-hidden="true"
      className="quiz-mark pointer-events-none absolute -inset-1.5 rotate-[-8deg] rounded-[50%] border-2 border-destructive/75"
      style={markStyle}
    />
  );

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
    <li
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
          <span className="ml-1.5 font-sans text-sm text-muted-foreground">
            {tPaper("questionPoints", { points })}
          </span>
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
          <p className="quiz-mark font-heading text-lg text-destructive italic" style={markStyle}>
            <span className="sr-only">{tReview("correctAnswer")} </span>→ {correctBlanks.join(", ")}
          </p>
        ) : null}
        {grade?.explanation ? (
          <p
            className={cn(
              "quiz-mark border-l-2 pl-3 font-heading text-[0.95rem] leading-6 italic",
              grade.isCorrect
                ? "border-border text-muted-foreground"
                : "border-destructive/50 text-destructive/90",
            )}
            style={markStyle}
          >
            {grade.explanation}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Badge variant="secondary">{categoryLabel}</Badge>
          {pointId ? (
            <OmitKnowledgePointButton
              knowledgePointId={pointId}
              isOmitted={isOmitted}
              onToggle={(omitted) => onToggleOmit(pointId, omitted)}
            />
          ) : null}
        </div>
      </div>
      {grade ? (
        <span
          className="quiz-mark flex shrink-0 flex-col items-center text-destructive"
          style={markStyle}
        >
          {grade.isCorrect ? (
            <Check className="size-10 -rotate-12" strokeWidth={3} />
          ) : (
            <>
              <X className="size-10 -rotate-12" strokeWidth={3} />
              <span className="-rotate-6 font-heading text-lg font-semibold">−{points}</span>
            </>
          )}
          <span className="sr-only">{grade.isCorrect ? tReview("correct") : tReview("wrong")}</span>
        </span>
      ) : null}
    </li>
  );
}

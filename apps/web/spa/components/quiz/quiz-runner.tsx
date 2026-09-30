import { Link } from "react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, type Variants } from "motion/react";
import { useTranslations } from "use-intl";
import {
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  ScanLine,
} from "lucide-react";
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
import { Button } from "@tmr/ui/components/button";
import { CtaIcon } from "@tmr/ui/components/cta-icon";
import { Card, CardContent } from "@tmr/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@tmr/ui/components/dialog";
import { Progress } from "@tmr/ui/components/progress";
import { Skeleton } from "@tmr/ui/components/skeleton";
import { cn } from "@tmr/ui/utils";
import {
  clearQuizDraft,
  loadQuizDraft,
  loadQuizOptionOrders,
  saveQuizDraft,
  saveQuizOptionOrders,
  type QuizOptionOrders,
} from "@/spa/lib/quiz-draft";
import { ExamReviewPanel } from "./exam-review";
import { LAST_MARK, PopMark, ScoreStamp } from "./marks";
import {
  blankCount,
  isAnswered,
  QuestionSheetItem,
  type QuestionGrade,
} from "./question-sheet-item";
import { Scantron } from "./scantron";
import type { LocalResponse, QuizQuestion } from "./types";

type SubmitResult = {
  attemptId: string;
  /** Set when the worker is writing an AI review of this exam's mistakes. */
  reviewPending?: boolean;
  correctCount: number;
  questionCount: number;
  results: QuestionGrade[];
};

/** How long the sheet takes to fly off before the graded copy can drop back in. */
const HAND_IN_MS = 700;

function emptyResponse(question: QuizQuestion): LocalResponse {
  if (question.type === "fill_blank") {
    return {
      blanks: Array.from({ length: blankCount(question.stem) }, () => ""),
    };
  }
  if (question.type === "true_false") {
    return { value: null };
  }
  return { index: null };
}

const FLOAT_ANSWER_SHEET_KEY = "tmr:float-answer-sheet";

function readFloatAnswerSheet(): boolean {
  try {
    return window.localStorage.getItem(FLOAT_ANSWER_SHEET_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFloatAnswerSheet(float: boolean) {
  try {
    window.localStorage.setItem(FLOAT_ANSWER_SHEET_KEY, float ? "1" : "0");
  } catch {
    // The choice just won't outlive the page.
  }
}

function buildOptionOrders(
  questions: QuizQuestion[],
  restored: QuizOptionOrders = {},
  previous: QuizOptionOrders = {},
): QuizOptionOrders {
  return Object.fromEntries(
    questions
      .filter(
        (question) => question.type === "mcq" || question.type === "image",
      )
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
      return new ApiRequestError(
        message,
        typeof code === "string" ? code : undefined,
      );
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
  onGraded,
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
  /** Called with the attempt id once graded, and with null when a new attempt starts. */
  onGraded?: (attemptId: string | null) => void;
}) {
  const isExam = kind === "exam";
  const t = useTranslations("Quiz.Runner");
  const tLayout = useTranslations("Layout");
  const tPaper = useTranslations("Quiz.Paper");
  const categoryT = useTranslations("Category");
  const categoryLabel = (category: string) =>
    CATEGORIES.includes(category as Category)
      ? categoryT(category as Category)
      : category;
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attemptToken, setAttemptToken] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, LocalResponse>>({});
  const [optionOrders, setOptionOrders] = useState<QuizOptionOrders>({});
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<
    "loading" | "taking" | "submitting" | "results" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [handedBack, setHandedBack] = useState(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState(true);
  // Floating keeps the sheet folded to its tab and lays it over the paper on hover.
  const [floatAnswerSheet, setFloatAnswerSheet] =
    useState(readFloatAnswerSheet);
  const [peekAnswerSheet, setPeekAnswerSheet] = useState(false);
  const [peekLeft, setPeekLeft] = useState(16);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [omittedPointIds, setOmittedPointIds] = useState<Set<string>>(
    new Set(),
  );
  // Pencil marks rubbed out on the answer sheet, as "questionId:choice".
  const [erased, setErased] = useState<Set<string>>(new Set());
  const startedAt = useRef(0);
  const questionStartedAt = useRef(0);
  const durations = useRef<Record<string, number>>({});
  const hasStarted = useRef(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const paperColumnRef = useRef<HTMLDivElement | null>(null);
  const peekRef = useRef<HTMLDivElement | null>(null);
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
    onGraded?.(null);
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
          throw (
            (await readError(response)) ?? new ApiRequestError(t("startError"))
          );
        }
        const data = (await response.json()) as {
          quiz: { questions: QuizQuestion[] };
        };
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
        setCurrent(
          Math.max(0, Math.min(draft.current, restoredQuestions.length - 1)),
        );
        scrollToRestored.current = draft.current > 0;
        durations.current = draft.durations;
        startedAt.current = draft.startedAt;
        questionStartedAt.current = draft.questionStartedAt;
        setPhase("taking");
        return;
      }
      const response = await fetch(`/api/quizzes/${quizId}/attempts`, {
        method: "POST",
      });
      if (!response.ok) {
        throw (
          (await readError(response)) ?? new ApiRequestError(t("startError"))
        );
      }
      const data = (await response.json()) as {
        attemptToken: string;
        questions: QuizQuestion[];
      };
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
      setError(
        startError instanceof Error ? startError.message : t("startError"),
      );
      setPhase("error");
    }
  }, [quizId, userId, t, onGraded]);

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
      setErased((previous) =>
        new Set(previous).add(`${questionId}:${String(before)}`),
      );
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
  }, [
    attemptToken,
    current,
    erased,
    optionOrders,
    phase,
    quizId,
    responses,
    userId,
  ]);

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

  // A floating answer sheet opens while the pointer is in the margin left of the paper,
  // and sits where the docked sheet would, without moving the paper over.
  useEffect(() => {
    if (!isExam || !floatAnswerSheet) {
      return;
    }
    const onMove = (event: MouseEvent) => {
      const paper = paperColumnRef.current?.getBoundingClientRect();
      const layout = layoutRef.current?.getBoundingClientRect();
      if (!paper || !layout) {
        return;
      }
      const inMargin =
        event.clientX < paper.left && event.clientY > Math.max(0, layout.top);
      const inSheet = peekRef.current?.contains(event.target as Node) ?? false;
      if (inMargin) {
        setPeekLeft(Math.max(16, paper.left - 32 - 368));
      }
      setPeekAnswerSheet(inMargin || inSheet);
    };
    const onLeave = () => setPeekAnswerSheet(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPeekAnswerSheet(false);
      }
    };
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("keydown", onKey);
    };
  }, [isExam, floatAnswerSheet]);

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
        throw (
          (await readError(response)) ?? new ApiRequestError(t("submitError"))
        );
      }
      const data = (await response.json()) as SubmitResult;
      clearQuizDraft(userId, quizId);
      await handedIn;
      setResult(data);
      setElapsedMs(durationMs);
      setHandedBack(true);
      setPhase("results");
      onGraded?.(data.attemptId);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("submitError");
      if (
        submitError instanceof ApiRequestError &&
        submitError.code === "attempt_invalid"
      ) {
        clearQuizDraft(userId, quizId);
      }
      await handedIn;
      setError(message);
      setHandedBack(true);
      setPhase("taking");
      toast.error(message);
    }
  }, [
    attemptToken,
    current,
    questions,
    quizId,
    responses,
    t,
    trackTime,
    userId,
    onGraded,
  ]);

  const focusQuestion = useCallback((questionId: string) => {
    const container = questionRefs.current[questionId];
    const target =
      container?.querySelector<HTMLElement>(
        '[data-quiz-answer] [data-state="checked"], [data-quiz-answer] [aria-pressed="true"]',
      ) ??
      container?.querySelector<HTMLElement>(
        "[data-quiz-answer] :is(input, button)",
      );
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
              <Link to={`/classrooms/${classroomId}/quizzes`}>
                {t("backToQuizzes")}
              </Link>
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
      (sum, { question }) =>
        sum + (gradeFor(question.id)?.isCorrect ? part.pointsEach : 0),
      0,
    );
  const earnedTotal = parts.reduce((sum, part) => sum + earnedIn(part), 0);
  const numeral = (partNumber: number) =>
    partNumeral(tPaper("numerals"), partNumber);
  const redMark = "font-heading font-semibold text-destructive";
  const submitting = phase === "submitting";
  // Totals land once the last question on the paper has its mark.
  const lastMark = Math.min(questions.length, LAST_MARK);
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
        const index = questions.findIndex(
          (question) => question.id === questionId,
        );
        if (index >= 0) {
          activate(index);
        }
        setAnswer(questionId, next);
      }}
      onJump={focusQuestion}
    />
  ) : null;

  const docked = showAnswerSheet && !floatAnswerSheet;
  const setFloat = (float: boolean) => {
    setFloatAnswerSheet(float);
    writeFloatAnswerSheet(float);
    setPeekAnswerSheet(float);
    if (!float) {
      setShowAnswerSheet(true);
    }
  };
  const sheetHeader = (
    <div className="flex items-center justify-between gap-2 pb-1.5 pl-1">
      <p className="text-xs text-muted-foreground tabular-nums">
        {graded
          ? t("score", {
              correct: graded.correctCount,
              total: graded.questionCount,
            })
          : t("answeredProgress", {
              answered: answeredCount,
              total: questions.length,
            })}
      </p>
      {docked ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label={t("collapseAnswerSheet")}
          title={t("collapseAnswerSheet")}
          aria-expanded
          onClick={() => setShowAnswerSheet(false)}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      ) : null}
    </div>
  );
  const floatToggle = (
    <label className="flex w-fit cursor-pointer items-center gap-2 px-1 pt-2 text-xs text-muted-foreground select-none hover:text-foreground">
      <input
        type="checkbox"
        className="size-3.5 cursor-pointer accent-primary"
        checked={floatAnswerSheet}
        onChange={(event) => setFloat(event.target.checked)}
      />
      {t("floatAnswerSheet")}
    </label>
  );
  const sheetTab = (
    <button
      type="button"
      className="hidden w-10 flex-col items-center gap-3 rounded-lg border border-border/70 bg-card py-3 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none lg:flex motion-safe:animate-in motion-safe:fade-in"
      aria-label={t("expandAnswerSheet")}
      title={t("expandAnswerSheet")}
      aria-expanded={floatAnswerSheet ? peekAnswerSheet : false}
      onClick={() => {
        if (!floatAnswerSheet) {
          setShowAnswerSheet(true);
          return;
        }
        const paper = paperColumnRef.current?.getBoundingClientRect();
        if (paper) {
          setPeekLeft(Math.max(16, paper.left - 32 - 368));
        }
        setPeekAnswerSheet((open) => !open);
      }}
    >
      <PanelLeftOpen className="size-4" />
      <span className="text-xs font-medium tracking-wide [writing-mode:vertical-rl]">
        {t("answerSheet")}
      </span>
      <span
        className={cn(
          "text-[0.65rem] leading-tight tabular-nums",
          graded ? redMark : "",
        )}
      >
        {graded ? graded.correctCount : answeredCount}
        <span className="block border-t border-current/40">
          {graded ? graded.questionCount : questions.length}
        </span>
      </span>
    </button>
  );

  return (
    <div
      ref={layoutRef}
      data-wide={isExam || undefined}
      className={cn(
        "relative mx-auto",
        isExam
          ? cn(
              "grid gap-8 lg:items-start",
              docked
                ? "max-w-6xl lg:grid-cols-[23rem_minmax(0,1fr)]"
                : "max-w-[58rem] lg:grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] lg:gap-10",
            )
          : "max-w-3xl",
      )}
    >
      {scantron && docked ? (
        <aside
          key={graded ? `${graded.attemptId}-card` : "card"}
          className="hidden lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col print:hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4"
        >
          {sheetHeader}
          <HandInSheet
            submitting={submitting}
            handedBack={handedBack}
            className="min-h-0 overflow-y-auto p-1"
          >
            {scantron}
          </HandInSheet>
          {floatToggle}
        </aside>
      ) : null}
      {scantron && !docked ? (
        <div className="hidden lg:sticky lg:top-6 lg:block print:hidden">
          {sheetTab}
        </div>
      ) : null}
      {scantron && floatAnswerSheet && peekAnswerSheet ? (
        <div
          ref={peekRef}
          key={graded ? `${graded.attemptId}-card` : "card"}
          style={{ left: peekLeft }}
          className="fixed top-6 z-40 hidden max-h-[calc(100dvh-3rem)] w-[23rem] flex-col rounded-xl border border-border/70 bg-background/95 p-2 shadow-[0_18px_48px_rgb(var(--shadow-colour)/0.22)] backdrop-blur-xl lg:flex print:hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2"
        >
          {sheetHeader}
          <HandInSheet
            submitting={submitting}
            handedBack={handedBack}
            className="min-h-0 overflow-y-auto p-1"
          >
            {scantron}
          </HandInSheet>
          {floatToggle}
        </div>
      ) : null}
      <div ref={paperColumnRef} className="relative min-w-0 space-y-5">
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
        <HandInSheet
          key={graded ? graded.attemptId : "sheet"}
          submitting={submitting}
          handedBack={handedBack}
          className="quiz-paper-stack"
        >
          <article className="quiz-paper">
            <header className="px-6 pt-8 sm:px-12 sm:pt-10">
              <p className="eyebrow text-center">{tLayout("title")}</p>
              <h2 className="mt-3 text-center font-heading text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                {title}
              </h2>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {subtitle}
              </p>
              <div className="mt-6 flex flex-col gap-4 border-b-[3px] border-double border-foreground/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1 text-sm">
                  {graded ? (
                    <PopMark
                      as="p"
                      className="font-heading text-base text-destructive italic"
                    >
                      {graded.correctCount === graded.questionCount
                        ? t("everyAnswerLanded")
                        : t("reviewMissed")}
                    </PopMark>
                  ) : (
                    <p className="text-muted-foreground">{instructions}</p>
                  )}
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
                        <td
                          key={part.section}
                          className="h-11 min-w-11 border border-foreground/60"
                        >
                          {graded ? (
                            <PopMark
                              order={lastMark}
                              className={cn(redMark, "text-lg")}
                            >
                              {earnedIn(part)}
                            </PopMark>
                          ) : null}
                        </td>
                      ))}
                      <td className="h-11 min-w-14 border border-foreground/60">
                        {graded ? (
                          <ScoreStamp
                            after={lastMark}
                            className={cn(redMark, "text-2xl")}
                          >
                            {earnedTotal}
                          </ScoreStamp>
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </header>
            {graded && isExam ? (
              <ExamReviewPanel
                attemptId={graded.attemptId}
                initiallyWriting={graded.reviewPending}
                onJump={(number) => {
                  const target = parts
                    .flatMap((part) => part.questions)
                    .find((entry) => entry.number === number);
                  if (target) {
                    focusQuestion(target.question.id);
                  }
                }}
                className="mx-6 mt-8 sm:mx-12"
              />
            ) : null}
            <div className="space-y-10 px-6 pt-8 pb-10 sm:px-12">
              {parts.map((part) => (
                <section
                  key={part.section}
                  aria-labelledby={`part-${part.section}`}
                >
                  <h3
                    id={`part-${part.section}`}
                    className="flex flex-wrap items-baseline gap-x-2 font-heading text-lg font-semibold"
                  >
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
                      <PopMark
                        order={lastMark}
                        className={cn(redMark, "ml-1 -rotate-6 text-xl")}
                      >
                        {earnedIn(part)}
                      </PopMark>
                    ) : null}
                  </h3>
                  <ol className="mt-5 space-y-9">
                    {part.questions.map(({ question, number }) => {
                      const index = number - 1;
                      const grade = gradeFor(question.id);
                      const pointId =
                        question.knowledgePointId ?? grade?.knowledgePointId;
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
                        >
                          {graded && pointId ? (
                            <Link
                              to={`/classrooms/${classroomId}/bank/${pointId}`}
                              className="text-sm text-primary underline underline-offset-4 print:hidden"
                            >
                              {t("openPoint")}
                            </Link>
                          ) : null}
                        </QuestionSheetItem>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </article>
        </HandInSheet>
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 print:hidden rounded-2xl border border-border/75 bg-background/85 p-2 pl-4 shadow-[0_10px_36px_rgb(var(--shadow-colour)/0.1)] backdrop-blur-xl">
          {graded ? (
            <>
              <p className="min-w-0 flex-1 text-sm font-medium">
                {t("score", {
                  correct: graded.correctCount,
                  total: graded.questionCount,
                })}
              </p>
              {scantron ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label={t("answerSheet")}
                    >
                      <ScanLine />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90dvh] overflow-y-auto p-3 sm:max-w-md">
                    <DialogTitle className="sr-only">
                      {t("answerSheet")}
                    </DialogTitle>
                    {scantron}
                  </DialogContent>
                </Dialog>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("print")}
                onClick={() => window.print()}
              >
                <Printer />
              </Button>
              <Button variant="outline" onClick={() => void startAttempt()}>
                <CtaIcon kind="retake" />
                {t("retake")}
              </Button>
              <Button asChild variant="outline">
                <Link
                  to={`/classrooms/${classroomId}/quizzes/${quizId}/attempts/${graded.attemptId}`}
                >
                  <CtaIcon kind="review" />
                  {t("fullReview")}
                </Link>
              </Button>
              <Button asChild>
                <Link to={`/classrooms/${classroomId}`}>
                  {isExam ? t("finishReview") : t("finish")}
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="mr-2 min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("answeredProgress", {
                    answered: answeredCount,
                    total: questions.length,
                  })}
                </p>
                <Progress
                  className="mt-1.5"
                  value={
                    questions.length > 0
                      ? (answeredCount / questions.length) * 100
                      : 0
                  }
                />
              </div>
              {scantron ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label={t("answerSheet")}
                    >
                      <ScanLine />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90dvh] overflow-y-auto p-3 sm:max-w-md">
                    <DialogTitle className="sr-only">
                      {t("answerSheet")}
                    </DialogTitle>
                    {scantron}
                  </DialogContent>
                </Dialog>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("print")}
                onClick={() => window.print()}
              >
                <Printer />
              </Button>
              <Button
                ref={submitRef}
                onClick={() => void submit()}
                disabled={phase === "submitting"}
              >
                {phase === "submitting" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CtaIcon kind="submit" />
                )}
                {phase === "submitting" ? t("submitting") : t("submit")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const SHEET: Variants = {
  // Where a graded copy starts before it drops back onto the desk.
  away: { y: "-110vh", rotate: 1.5 },
  handIn: {
    y: "-110vh",
    rotate: -2.5,
    opacity: 0.6,
    transition: { duration: 0.5, ease: [0.55, 0, 0.75, 0.2] },
  },
  rest: {
    y: 0,
    rotate: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 170, damping: 19 },
  },
};

/** A sheet that flies up when handed in and drops back once it is marked. */
export function HandInSheet({
  submitting,
  handedBack,
  className,
  children,
}: {
  submitting: boolean;
  handedBack: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={SHEET}
      initial={handedBack ? "away" : false}
      animate={submitting ? "handIn" : "rest"}
      className={cn(className, submitting && "pointer-events-none")}
    >
      {children}
    </motion.div>
  );
}

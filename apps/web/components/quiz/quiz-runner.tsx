"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIES,
  isIndexOrder,
  shuffledIndexOrder,
  type Category,
} from "@tmr/core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  clearQuizDraft,
  loadQuizDraft,
  loadQuizOptionOrders,
  saveQuizDraft,
  saveQuizOptionOrders,
  type QuizOptionOrders,
} from "@/lib/quiz-draft";
import { QuestionReviewCard, type AnswerShape } from "./question-review";
import { OmitKnowledgePointButton } from "./omit-knowledge-point-button";
import type { LocalResponse, QuizQuestion } from "./types";

type SubmitResult = {
  attemptId: string;
  correctCount: number;
  questionCount: number;
  results: {
    questionId: string;
    knowledgePointId?: string;
    isKnowledgePointRetired?: boolean;
    isCorrect: boolean;
    correctAnswer: AnswerShape;
    explanation: string;
  }[];
};

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
}: {
  quizId: string;
  classroomId: string;
  userId: string;
}) {
  const t = useTranslations("Quiz.Runner");
  const tReview = useTranslations("Quiz.QuestionReview");
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
  const [omittedPointIds, setOmittedPointIds] = useState<Set<string>>(new Set());
  const startedAt = useRef(0);
  const questionStartedAt = useRef(0);
  const durations = useRef<Record<string, number>>({});
  const hasStarted = useRef(false);
  const blankRefs = useRef<(HTMLInputElement | null)[]>([]);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusFirstBlank = useRef(false);

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
    setResponses({});
    setOptionOrders({});
    setQuestions([]);
    setOmittedPointIds(new Set());
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
        const restoredQuestions = data.quiz.questions;
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
        setCurrent(Math.max(0, Math.min(draft.current, restoredQuestions.length - 1)));
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

  const goTo = (index: number, questionId: string) => {
    trackTime(questionId);
    setCurrent(index);
  };

  const setAnswer = (questionId: string, response: LocalResponse) => {
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
      savedAt: Date.now(),
    });
  }, [attemptToken, current, optionOrders, phase, quizId, responses, userId]);

  useEffect(() => {
    if (phase !== "taking" || !focusFirstBlank.current) {
      return;
    }
    focusFirstBlank.current = false;
    blankRefs.current[0]?.focus();
  }, [current, phase]);

  useEffect(() => {
    if (phase !== "taking") {
      return;
    }
    const question = questions[current];
    if (!question || (question.type !== "mcq" && question.type !== "image")) {
      return;
    }
    const order = optionOrders[question.id];
    const selectedIndex = responses[question.id]?.index;
    const indexToFocus =
      typeof selectedIndex === "number" && order?.includes(selectedIndex)
        ? selectedIndex
        : order?.[0];
    if (typeof indexToFocus === "number") {
      optionRefs.current[indexToFocus]?.focus();
    }
  }, [current, optionOrders, phase, questions, responses]);

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
    try {
      const response = await fetch("/api/attempts/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptToken,
          durationMs: Date.now() - startedAt.current,
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
      setResult(data);
      setPhase("results");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("submitError");
      if (submitError instanceof ApiRequestError && submitError.code === "attempt_invalid") {
        clearQuizDraft(userId, quizId);
      }
      setError(message);
      setPhase("taking");
      toast.error(message);
    }
  }, [attemptToken, current, questions, quizId, responses, t, trackTime, userId]);

  const goNext = useCallback(() => {
    const activeQuestion = questions[current];
    if (!activeQuestion) {
      return;
    }
    if (current < questions.length - 1) {
      focusFirstBlank.current = true;
      trackTime(activeQuestion.id);
      setCurrent(current + 1);
      return;
    }
    void submit();
  }, [current, questions, submit, trackTime]);

  useEffect(() => {
    if (phase !== "taking") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.isComposing) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      event.preventDefault();
      if (target instanceof HTMLInputElement && target.type === "text") {
        const index = blankRefs.current.indexOf(target);
        const activeQuestion = questions[current];
        const count = activeQuestion ? blankCount(activeQuestion.stem) : 0;
        if (index >= 0 && index < count - 1) {
          blankRefs.current[index + 1]?.focus();
          return;
        }
      }
      goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, goNext, phase, questions]);

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
              <Link href={`/classrooms/${classroomId}/quizzes`}>{t("backToQuizzes")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "results" && result) {
    const scorePercent =
      result.questionCount > 0
        ? Math.round((result.correctCount / result.questionCount) * 100)
        : 0;
    const scoreTone =
      scorePercent >= 80 ? "success" : scorePercent >= 50 ? "warning" : "destructive";
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="relative overflow-hidden border-primary/15 bg-primary/[0.045]">
          <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-primary/30" />
          <CardContent className="flex flex-col items-center gap-6 py-4 text-center sm:flex-row sm:text-left">
            <div
              className="relative grid size-28 shrink-0 place-items-center rounded-full p-2"
              style={{
                background: `conic-gradient(var(--primary) ${scorePercent}%, var(--muted) 0)`,
              }}
              aria-hidden="true"
            >
              <span className="grid size-full place-items-center rounded-full bg-card font-heading text-3xl font-semibold text-primary">
                {scorePercent}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <CheckCircle2 className="size-4.5 text-primary" />
                <h2 className="font-heading text-2xl font-semibold tracking-[-0.025em]">
                  {t("score", {
                    correct: result.correctCount,
                    total: result.questionCount,
                  })}
                </h2>
                <Badge variant={scoreTone}>{scorePercent}%</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.correctCount === result.questionCount
                  ? t("everyAnswerLanded")
                  : t("reviewMissed")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-center gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => void startAttempt()}>
                {t("retake")}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/classrooms/${classroomId}/attempts/${result.attemptId}`}>
                  {t("fullReview")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center gap-3 pt-3">
          <span className="h-px flex-1 bg-border" />
          <p className="eyebrow">{t("reviewTitle")}</p>
          <span className="h-px flex-1 bg-border" />
        </div>
        {questions.map((question) => {
          const item = result.results.find((entry) => entry.questionId === question.id);
          if (!item) {
            return null;
          }
          const pointId = question.knowledgePointId ?? item.knowledgePointId;
          const isOmitted = pointId
            ? omittedPointIds.has(pointId)
            : (item.isKnowledgePointRetired ?? false);
          return (
            <QuestionReviewCard
              key={question.id}
              question={{
                ...question,
                knowledgePointId: pointId,
                isKnowledgePointRetired: isOmitted,
              }}
              response={responses[question.id]}
              correctAnswer={item.correctAnswer}
              isCorrect={item.isCorrect}
              explanation={item.explanation}
              onOmitToggle={handleToggleOmit}
            />
          );
        })}
      </div>
    );
  }

  const currentQuestion = questions[current];
  if (!currentQuestion) {
    return null;
  }
  const response = responses[currentQuestion.id];
  const sourceOptions = currentQuestion.options ?? [];
  const currentOptionOrder = isIndexOrder(
    optionOrders[currentQuestion.id],
    sourceOptions.length,
  )
    ? optionOrders[currentQuestion.id]
    : sourceOptions.map((_, index) => index);
  const answeredCount = questions.filter((question) =>
    isAnswered(question, responses[question.id]),
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-xl border border-border/70 bg-card/55 px-4 py-3">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            {t("questionProgress", { current: current + 1, total: questions.length })}
          </span>
          <span>
            {t("answeredProgress", { answered: answeredCount, total: questions.length })}
          </span>
        </div>
        <Progress className="mt-2.5" value={((current + 1) / questions.length) * 100} />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="relative min-h-[25rem] border-primary/10">
        <div aria-hidden="true" className="absolute inset-y-6 left-0 w-px bg-primary/25" />
        <CardContent className="space-y-6 py-2 sm:px-8 sm:py-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{categoryLabel(currentQuestion.category)}</Badge>
              {currentQuestion.knowledgePointId ? (
                <OmitKnowledgePointButton
                  knowledgePointId={currentQuestion.knowledgePointId}
                  isOmitted={omittedPointIds.has(currentQuestion.knowledgePointId)}
                  onToggle={(omitted) =>
                    handleToggleOmit(currentQuestion.knowledgePointId!, omitted)
                  }
                />
              ) : null}
            </div>
            <span className="font-heading text-sm italic text-muted-foreground/60">
              {String(current + 1).padStart(2, "0")}
            </span>
          </div>
          <h2 className="whitespace-pre-wrap font-heading text-2xl leading-snug font-semibold tracking-[-0.02em] sm:text-3xl">
            {currentQuestion.stem}
          </h2>
          {currentQuestion.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentQuestion.imageUrl}
              alt={tReview("handwritten")}
              className="max-h-80 rounded-xl border border-border/70 bg-muted/30 object-contain"
            />
          ) : null}
          {currentQuestion.type === "mcq" || currentQuestion.type === "image" ? (
            <RadioGroup
              value={typeof response?.index === "number" ? String(response.index) : ""}
              onValueChange={(value) =>
                setAnswer(currentQuestion.id, { index: Number(value) })
              }
              onKeyDownCapture={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                if (currentOptionOrder.length === 0) {
                  return;
                }
                const selectedPosition =
                  typeof response?.index === "number"
                    ? currentOptionOrder.indexOf(response.index)
                    : -1;
                const nextPosition =
                  selectedPosition < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : currentOptionOrder.length - 1
                    : (selectedPosition +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        currentOptionOrder.length) %
                      currentOptionOrder.length;
                const nextIndex = currentOptionOrder[nextPosition];
                if (typeof nextIndex === "number") {
                  setAnswer(currentQuestion.id, { index: nextIndex });
                  optionRefs.current[nextIndex]?.focus();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.repeat) {
                  event.preventDefault();
                  goNext();
                }
              }}
            >
              {currentOptionOrder.map((optionIndex, displayIndex) => {
                const option = sourceOptions[optionIndex];
                const selected = response?.index === optionIndex;
                const optionId = `${currentQuestion.id}-option-${optionIndex}`;
                return (
                  <Label
                    key={optionId}
                    htmlFor={optionId}
                    className={cn(
                      "group/option mb-0 w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm leading-normal font-normal transition has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/25",
                      selected
                        ? "border-primary/45 bg-primary/[0.07] shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary),transparent_70%)]"
                        : "border-border/80 bg-card/45 hover:border-primary/20 hover:bg-muted/60",
                    )}
                  >
                    <RadioGroupItem
                      ref={(element) => {
                        optionRefs.current[optionIndex] = element;
                      }}
                      value={String(optionIndex)}
                      id={optionId}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-lg border text-[0.65rem] font-semibold transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/50 text-muted-foreground group-hover/option:text-foreground",
                      )}
                    >
                      {String.fromCharCode(65 + displayIndex)}
                    </span>
                    <span className="flex-1">{option}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          ) : null}
          {currentQuestion.type === "true_false" ? (
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((value) => {
                const selected = response?.value === value;
                return (
                  <Button
                    key={String(value)}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="h-12"
                    onClick={() => setAnswer(currentQuestion.id, { value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.repeat) {
                        event.preventDefault();
                        goNext();
                      }
                    }}
                  >
                    {value ? tReview("true") : tReview("false")}
                  </Button>
                );
              })}
            </div>
          ) : null}
          {currentQuestion.type === "fill_blank" ? (
            <div className="space-y-3">
              {Array.from({ length: blankCount(currentQuestion.stem) }).map((_, index) => (
                <div key={index}>
                  <Label htmlFor={`${currentQuestion.id}-blank-${index}`}>
                    {t("blank", { number: index + 1 })}
                  </Label>
                  <Input
                    id={`${currentQuestion.id}-blank-${index}`}
                    ref={(element) => {
                      blankRefs.current[index] = element;
                    }}
                  value={response?.blanks?.[index] ?? ""}
                  enterKeyHint={
                    index < blankCount(currentQuestion.stem) - 1 ||
                    current < questions.length - 1
                      ? "next"
                      : "go"
                  }
                  onChange={(event) => {
                    const count = blankCount(currentQuestion.stem);
                    const blanks = Array.from(
                      { length: count },
                      (_, blankIndex) => response?.blanks?.[blankIndex] ?? "",
                    );
                    blanks[index] = event.target.value;
                    setAnswer(currentQuestion.id, { blanks });
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
        </CardContent>
      </Card>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/75 bg-background/85 p-2 shadow-[0_10px_36px_rgb(var(--shadow-colour)/0.1)] backdrop-blur-xl">
        <Button
          variant="outline"
          onClick={() => goTo(current - 1, currentQuestion.id)}
          disabled={current === 0}
        >
          <ArrowLeft />
          {t("back")}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => goTo(current + 1, currentQuestion.id)}
            disabled={current === questions.length - 1}
          >
            {t("next")}
            <ArrowRight />
          </Button>
          <Button onClick={() => void submit()} disabled={phase === "submitting"}>
            {phase === "submitting" ? <Loader2 className="animate-spin" /> : null}
            {phase === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

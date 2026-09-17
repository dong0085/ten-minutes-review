"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type JobStatus = "pending" | "running";
type Phase = "idle" | "posting" | "composing" | "ready" | "stopped" | "failed";

type TodayResponse = {
  quiz: { id: string } | null;
  job: { status: JobStatus; requestedAt: string } | null;
};

const POLL_MS = 3000;
const TIMEOUT_SECONDS = 90;
const MIN_STEP_MS = 600;

export function TodayQuizAction({
  classroomId,
  dailyQuizId,
  bankSize,
  paused,
  nowMs,
  autoStart = false,
  initialJob,
  resetLocal,
  resetUtc,
  resetTomorrow,
}: {
  classroomId: string;
  dailyQuizId: string | null;
  bankSize: number;
  paused: boolean;
  nowMs: number;
  autoStart?: boolean;
  initialJob: { status: JobStatus; requestedAt: string } | null;
  resetLocal: string;
  resetUtc: string;
  resetTomorrow: boolean;
}) {
  const t = useTranslations("Classroom.TodayQuiz");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const autoStartedRef = useRef(false);
  const initialElapsed = initialJob
    ? Math.max(0, (nowMs - Date.parse(initialJob.requestedAt)) / 1000)
    : 0;
  const [phase, setPhase] = useState<Phase>(initialJob ? "composing" : "idle");
  const [minimized, setMinimized] = useState(Boolean(initialJob));
  const [step, setStep] = useState<JobStatus>(initialJob?.status ?? "pending");
  const stepEnteredAtRef = useRef(nowMs);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsed, setElapsed] = useState(Math.floor(initialElapsed));
  const [readyQuizId, setReadyQuizId] = useState<string | null>(null);

  const activeQuizId = dailyQuizId ?? readyQuizId;
  const showModal = phase !== "idle" && !minimized;

  const fetchToday = useCallback(async (): Promise<TodayResponse | null> => {
    const response = await fetch(`/api/classrooms/${classroomId}/quizzes/today`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as TodayResponse;
  }, [classroomId]);

  useEffect(() => {
    if (phase !== "composing") {
      return;
    }
    const interval = setInterval(() => {
      setElapsed((current) => current + POLL_MS / 1000);
      void fetchToday().then((data) => {
        if (!data) {
          return;
        }
        if (data.quiz) {
          setReadyQuizId(data.quiz.id);
          setPhase("ready");
          router.refresh();
          return;
        }
        if (!data.job) {
          setPhase("failed");
          return;
        }
        if (data.job.status === "running" && step === "pending") {
          const wait = Math.max(0, MIN_STEP_MS - (Date.now() - stepEnteredAtRef.current));
          advanceTimeoutRef.current = setTimeout(() => {
            stepEnteredAtRef.current = Date.now();
            setStep("running");
          }, wait);
        }
      });
    }, POLL_MS);
    return () => {
      clearInterval(interval);
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
    };
  }, [phase, fetchToday, router, step]);

  const minimize = useCallback(() => {
    setMinimized(true);
  }, []);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setMinimized(false);
    setStep("pending");
  }, []);

  const start = useCallback(async () => {
    setPhase("posting");
    setMinimized(false);
    setStep("pending");
    stepEnteredAtRef.current = Date.now();
    setElapsed(0);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/quizzes`, {
        method: "POST",
      });
      if (response.status === 409) {
        setPhase("failed");
        return;
      }
      if (!response.ok) {
        setPhase("failed");
        return;
      }
      const data = (await response.json()) as { status?: string };
      if (data.status === "ready") {
        const today = await fetchToday();
        if (today?.quiz) {
          setReadyQuizId(today.quiz.id);
          setPhase("ready");
          return;
        }
      }
      setPhase("composing");
    } catch {
      setPhase("failed");
    }
  }, [classroomId, fetchToday]);

  const cancel = useCallback(async () => {
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/quizzes/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { outcome?: string };
      if (data.outcome === "too_late") {
        const today = await fetchToday();
        if (today?.quiz) {
          setReadyQuizId(today.quiz.id);
          setPhase("ready");
          router.refresh();
          return;
        }
      }
      setPhase("stopped");
      router.refresh();
    } catch {
      // Keep showing progress; polling will settle the state.
    }
  }, [classroomId, fetchToday, router]);

  const checkAgain = useCallback(() => {
    setElapsed(0);
    setPhase("composing");
  }, []);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) {
      return;
    }
    autoStartedRef.current = true;
    const frame = requestAnimationFrame(() => {
      if (bankSize > 0) {
        void start();
      }
      router.replace(`/classrooms/${classroomId}`);
    });
    return () => cancelAnimationFrame(frame);
  }, [autoStart, bankSize, classroomId, router, start]);

  const composing = phase === "posting" || phase === "composing";
  const timedOut = composing && elapsed >= TIMEOUT_SECONDS;
  const stepIndex = step === "running" ? 1 : 0;

  const steps = [
    { key: "queued", label: t("stepQueued") },
    { key: "writing", label: t("stepWriting") },
    { key: "ready", label: t("stepReady") },
  ];

  const inlineProgress = (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-card/70 px-3 py-2.5">
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="flex items-center gap-2 text-sm font-medium text-foreground"
      >
        {phase === "posting" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : step === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        )}
        {phase === "posting" || step === "pending" ? t("stepQueued") : t("stepWriting")}
      </button>
      <button
        type="button"
        onClick={cancel}
        className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
      >
        {tCommon("cancel")}
      </button>
    </div>
  );

  return (
    <>
      <div className="flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <Sparkles className="size-3" />
              {t("kicker")}
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em]">
              {t("title")}
            </h2>
          </div>
          <span aria-hidden="true" className="font-heading text-4xl font-semibold italic text-primary/25">
            10′
          </span>
        </div>
        <div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            {paused ? t("paused") : activeQuizId ? t("ready") : t("idle")}
          </p>
          {!paused ? (
            <p className="mt-1 text-xs text-muted-foreground/80">
              {resetTomorrow
                ? t("resetAtTomorrow", { local: resetLocal, utc: resetUtc })
                : t("resetAt", { local: resetLocal, utc: resetUtc })}
            </p>
          ) : null}
        </div>
        <div>
          {activeQuizId ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild>
                  <Link href={`/classrooms/${classroomId}/quiz/${activeQuizId}`}>
                    {t("takeToday")}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button variant="outline" onClick={start} disabled={composing}>
                  {t("createNow")}
                </Button>
              </div>
              {composing && minimized ? inlineProgress : null}
            </div>
          ) : bankSize === 0 ? (
            <div className="space-y-2">
              <Button disabled>{t("createNow")}</Button>
              <p className="text-xs text-muted-foreground">
                <Link
                  className="underline hover:text-foreground"
                  href={`/classrooms/${classroomId}/upload`}
                >
                  {t("addNotes")}
                </Link>{" "}
                {t("addNotesSuffix")}
              </p>
            </div>
          ) : composing && minimized ? (
            inlineProgress
          ) : (
            <Button onClick={start} disabled={phase === "posting"}>
              {t("createNow")}
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={showModal}
        onOpenChange={(next) => {
          if (next) {
            return;
          }
          if (phase === "posting" || phase === "composing") {
            minimize();
            return;
          }
          dismiss();
        }}
      >
        <DialogContent showCloseButton={false}>
          {composing && !timedOut ? (
            <>
              <DialogHeader>
                <DialogTitle aria-live="polite">
                  {phase === "posting" ? t("stepQueued") : steps[stepIndex]?.label}
                </DialogTitle>
                <DialogDescription>
                  {elapsed < 10
                    ? t("hintFewSeconds")
                    : elapsed < 30
                      ? t("hintLonger")
                      : t("hintAlmost")}
                </DialogDescription>
              </DialogHeader>
              <ol className="space-y-2 rounded-xl border border-border/70 bg-muted/40 p-3">
                {steps.map((entry, index) => {
                  const done = index < stepIndex;
                  const current = index === stepIndex;
                  return (
                    <li key={entry.key} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm">
                      {done ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      ) : current ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-border" />
                      )}
                      <span
                        className={
                          current ? "font-medium text-foreground" : "text-muted-foreground"
                        }
                      >
                        {entry.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <DialogFooter>
                <Button variant="ghost" onClick={cancel}>
                  {tCommon("cancel")}
                </Button>
                <Button variant="outline" onClick={minimize}>
                  {t("minimize")}
                </Button>
              </DialogFooter>
            </>
          ) : phase === "ready" && readyQuizId ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("readyTitle")}</DialogTitle>
                <DialogDescription>
                  {t("knowledgePoints", { count: bankSize })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={dismiss}>
                  {t("close")}
                </Button>
                <Button variant="outline" onClick={start}>
                  {t("createAnother")}
                </Button>
                <Button asChild>
                  <Link href={`/classrooms/${classroomId}/quiz/${readyQuizId}`}>
                    {t("take")}
                  </Link>
                </Button>
              </DialogFooter>
            </>
          ) : timedOut ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("timeoutTitle")}</DialogTitle>
                <DialogDescription>{t("timeoutBlurb")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={dismiss}>
                  {t("close")}
                </Button>
                <Button onClick={checkAgain}>{t("checkAgain")}</Button>
              </DialogFooter>
            </>
          ) : phase === "stopped" ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("stoppedTitle")}</DialogTitle>
                <DialogDescription>{t("stoppedBlurb")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={dismiss}>
                  {t("close")}
                </Button>
                <Button onClick={start}>{t("createNow")}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("failedTitle")}</DialogTitle>
                <DialogDescription>{t("failedBlurb")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={dismiss}>
                  {t("close")}
                </Button>
                <Button onClick={start}>{t("tryAgain")}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

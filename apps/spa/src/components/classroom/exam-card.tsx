import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ArrowRight, Loader2, Lock, ScrollText } from "lucide-react";
import { EXAM_MINUTES, EXAM_QUESTION_COUNT } from "@tmr/core";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tmr/ui/components/dialog";
import { Progress } from "@tmr/ui/components/progress";
import { BillingButton } from "@/components/account/billing-button";
import { ApiError, api } from "@/lib/api";
import { formatQuizDate } from "@/lib/format";
import type { ClassroomOverview } from "@/lib/queries";
import { useRouter } from "@/lib/router";

const POLL_MS = 2500;

type Phase = "idle" | "writing" | "ready" | "failed";

/**
 * The exam on the classroom hub. It counts up to the bank size an exam needs,
 * says so once the bank gets there, and writes one on request.
 */
export function ExamCard({
  classroomId,
  bankSize,
  exam,
  isPaid,
  billingEnabled,
}: {
  classroomId: string;
  bankSize: number;
  exam: ClassroomOverview["exam"];
  isPaid: boolean;
  billingEnabled: boolean;
}) {
  const t = useTranslations("Classroom.ExamCard");
  const locale = useLocale();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(exam.composeJob ? "writing" : "idle");
  const [jobId, setJobId] = useState<string | null>(exam.composeJob?.id ?? null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unlocked = bankSize >= exam.requiredPoints;
  const untakenId =
    readyId ?? (exam.latest && exam.latest.attemptCount === 0 ? exam.latest.id : null);

  useEffect(() => {
    if (phase !== "writing" || !jobId) {
      return;
    }
    const interval = setInterval(() => {
      void fetch(`/api/classrooms/${classroomId}/quizzes/jobs/${jobId}`).then(async (response) => {
        if (response.status === 404) {
          setPhase("failed");
          return;
        }
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { status: string; quizId: string | null };
        if (data.status === "done" && data.quizId) {
          setReadyId(data.quizId);
          setPhase("ready");
          router.refresh();
        } else if (data.status === "cancelled") {
          setPhase("idle");
        } else if (data.status === "done" || data.status === "failed") {
          setPhase("failed");
        }
      });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [classroomId, jobId, phase, router]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const data = await api.post<{ jobId: string | null }>(`/api/classrooms/${classroomId}/exams`);
      setJobId(data.jobId);
      setPhase("writing");
    } catch (startError) {
      setError(startError instanceof ApiError ? startError.message : t("failed"));
    }
  }, [classroomId, t]);

  const cancel = useCallback(async () => {
    await api.post(`/api/classrooms/${classroomId}/exams/cancel`).catch(() => null);
    setPhase("idle");
    setJobId(null);
  }, [classroomId]);

  return (
    <section className="editorial-surface flex flex-col gap-5 rounded-[1.6rem] px-6 py-6 sm:flex-row sm:items-center sm:px-8">
      <div className="min-w-0 flex-1">
        <p className="eyebrow flex items-center gap-1.5">
          <ScrollText className="size-3" />
          {t("kicker")}
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.025em]">
          {unlocked ? t("readyTitle") : t("lockedTitle")}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {unlocked
            ? t("readyBlurb", { count: EXAM_QUESTION_COUNT, minutes: EXAM_MINUTES })
            : t("lockedBlurb", { required: exam.requiredPoints, count: EXAM_QUESTION_COUNT })}
        </p>
        {!unlocked ? (
          <div className="mt-4 max-w-sm">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{t("progress", { count: bankSize, required: exam.requiredPoints })}</span>
              <span>{Math.round((bankSize / exam.requiredPoints) * 100)}%</span>
            </div>
            <Progress className="mt-1.5" value={(bankSize / exam.requiredPoints) * 100} />
          </div>
        ) : null}
        {exam.latest && phase !== "writing" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("latest", { date: formatQuizDate(exam.latest.quizDate, locale) })} ·{" "}
            <Link
              to={`/classrooms/${classroomId}/quizzes/${exam.latest.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("viewLatest")}
            </Link>
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {phase === "failed" ? <p className="mt-3 text-sm text-destructive">{t("failed")}</p> : null}
      </div>

      {unlocked ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {!isPaid ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Lock />
                  {t("start")}
                  <Badge>{t("proBadge")}</Badge>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("proTitle")}</DialogTitle>
                  <DialogDescription>{t("proBody")}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:items-start">
                  <DialogClose asChild>
                    <Button variant="ghost">{t("close")}</Button>
                  </DialogClose>
                  {billingEnabled ? <BillingButton action="checkout" /> : null}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : phase === "writing" ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />
                <span>
                  {t("writing")}
                  <span className="block text-xs">{t("writingHint")}</span>
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => void cancel()}>
                {t("cancel")}
              </Button>
            </div>
          ) : untakenId ? (
            <Button asChild size="lg">
              <Link to={`/classrooms/${classroomId}/quizzes/${untakenId}/take`}>
                {t("take")}
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button size="lg" onClick={() => void start()}>
              {phase === "failed" ? t("retry") : t("start")}
              <ArrowRight />
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

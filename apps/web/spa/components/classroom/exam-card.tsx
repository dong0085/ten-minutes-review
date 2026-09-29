import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
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
import { BillingButton } from "@/spa/components/account/billing-button";
import { ApiError, api } from "@/spa/lib/api";
import { formatQuizDate } from "@/spa/lib/format";
import type { ClassroomOverview } from "@/spa/lib/queries";
import { useRouter } from "@/spa/lib/router";
import { PEEK_SPRING, usePeek } from "@/spa/lib/use-peek";

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
  const peek = usePeek();
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
    <motion.section
      {...peek}
      className="editorial-surface flex flex-col gap-5 rounded-[1.6rem] px-6 py-6 sm:flex-row sm:items-center sm:gap-7 sm:px-8"
    >
      <ExamStack unlocked={unlocked} open={peek.animate === "open"} label={t("kicker")} />
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
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((bankSize / exam.requiredPoints) * 100)}
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary/20"
            >
              <motion.div
                className="h-full origin-left rounded-full bg-primary"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.min(1, bankSize / exam.requiredPoints) }}
                transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.2 }}
              />
            </div>
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
    </motion.section>
  );
}

/**
 * A stack of exam papers. It sits in a messy pile until the bank can fill an
 * exam, squares up when it can, and fans out while the card is hovered.
 */
function ExamStack({ unlocked, open, label }: { unlocked: boolean; open: boolean; label: string }) {
  const sheet =
    "absolute inset-0 origin-bottom rounded-sm border border-border/70 bg-card shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.08)]";
  return (
    <motion.div
      aria-hidden="true"
      initial="messy"
      animate={open ? "open" : unlocked ? "rest" : "messy"}
      className="relative hidden h-28 w-22 shrink-0 sm:block"
    >
      <motion.div
        variants={{
          messy: { x: -6, y: 2, rotate: -11 },
          rest: { x: 0, y: 0, rotate: -5 },
          open: { x: -4, y: 0, rotate: -13 },
        }}
        transition={PEEK_SPRING}
        className={sheet}
      />
      <motion.div
        variants={{
          messy: { x: 5, y: -1, rotate: 7 },
          rest: { x: 0, y: 0, rotate: -2 },
          open: { x: 0, y: 0, rotate: -6 },
        }}
        transition={{ ...PEEK_SPRING, delay: 0.03 }}
        className={sheet}
      />
      <motion.div
        variants={{
          messy: { x: -2, y: 3, rotate: -3 },
          rest: { x: 0, y: 0, rotate: 1 },
          open: { x: 0, y: -8, rotate: 3 },
        }}
        transition={{ ...PEEK_SPRING, delay: 0.06 }}
        className={`${sheet} shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.08),0_12px_24px_rgb(var(--shadow-colour)/0.12)]`}
      >
        <p className="border-b border-dashed border-border px-2 pt-2 pb-1 text-[0.55rem] font-bold tracking-[0.18em] text-primary uppercase">
          {label}
        </p>
        <div className="space-y-1.5 px-2 pt-2">
          <span className="block h-1 w-4/5 rounded-full bg-foreground/15" />
          <span className="block h-1 w-3/5 rounded-full bg-foreground/10" />
          <span className="block h-1 w-2/3 rounded-full bg-foreground/10" />
          <span className="block h-1 w-1/2 rounded-full bg-foreground/10" />
        </div>
        {/* Binder clip on the top edge. */}
        <span className="absolute -top-1.5 left-1/2 h-3 w-7 -translate-x-1/2 rounded-sm bg-foreground/70" />
        {unlocked ? null : (
          <span className="absolute right-1.5 bottom-1.5 flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="size-3" />
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}

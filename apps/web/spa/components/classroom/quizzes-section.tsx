import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "use-intl";
import { ArrowRight, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { CtaIcon } from "@tmr/ui/components/cta-icon";
import { cn } from "@tmr/ui/utils";
import { SectionTitle } from "@/spa/components/page";
import { formatQuizDate } from "@/spa/lib/format";
import type { ClassroomOverview, QuizListItem } from "@/spa/lib/queries";
import { useRouter } from "@/spa/lib/router";
import { PEEK_SPRING } from "@/spa/lib/use-peek";
import { ExamCard } from "./exam-card";
import { QuizWriting } from "./quiz-writing";
import type { QuizJob } from "./use-quiz-job";

/** Rows slide into place as the list changes; a new one drops in from above. */
const ROW_MOTION = {
  layout: "position" as const,
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  // A quick fade out, so the spring's bounce never holds a leaving row on screen.
  exit: { opacity: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
  transition: PEEK_SPRING,
};

/**
 * Every quiz and exam in one place: a tile to create an on-demand quiz, the
 * exam tile, and the latest quizzes and exams with their date and score. A
 * quiz being written shows at the head of the list until it is ready.
 */
export function QuizzesSection({
  classroomId,
  quizzes,
  totalQuizzes,
  bankSize,
  exam,
  isGuest,
  isPaid,
  billingEnabled,
  autoStart,
  job,
}: {
  classroomId: string;
  quizzes: QuizListItem[];
  totalQuizzes: number;
  bankSize: number;
  exam: ClassroomOverview["exam"];
  isGuest: boolean;
  isPaid: boolean;
  billingEnabled: boolean;
  /** Start an on-demand quiz on arrival, as the Add notes screen asks. */
  autoStart: boolean;
  job: QuizJob;
}) {
  const t = useTranslations("Classroom.HomePage");
  const base = `/classrooms/${classroomId}`;
  const router = useRouter();
  const autoStartedRef = useRef(false);
  const { start } = job;

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) {
      return;
    }
    autoStartedRef.current = true;
    const frame = requestAnimationFrame(() => {
      if (bankSize > 0) {
        void start();
      }
      router.replace(base);
    });
    return () => cancelAnimationFrame(frame);
  }, [autoStart, bankSize, base, router, start]);

  const showJob = job.phase !== "idle";

  return (
    <section className="space-y-4">
      <SectionTitle
        action={
          totalQuizzes > 0 ? (
            <Link
              to={`${base}/quizzes`}
              className="inline-flex items-center gap-0.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("seeAllQuizzes", { count: totalQuizzes })}
              <ChevronRight className="size-4" />
            </Link>
          ) : null
        }
      >
        {t("quizzesTitle")}
      </SectionTitle>

      <div className={cn("grid gap-4", !isGuest && "md:grid-cols-2")}>
        <OnDemandTile bankSize={bankSize} job={job} />
        {isGuest ? null : (
          <ExamCard
            classroomId={classroomId}
            bankSize={bankSize}
            exam={exam}
            isPaid={isPaid}
            billingEnabled={billingEnabled}
          />
        )}
      </div>

      {!showJob && quizzes.length === 0 ? (
        // With a bank, the tiles above already say how to get a first quiz.
        bankSize === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noQuizzes")}</p>
        ) : null
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.035)]">
          <AnimatePresence initial={false} mode="popLayout">
            {showJob ? (
              <motion.li key="job" {...ROW_MOTION} role="status" aria-live="polite">
                <JobRow job={job} />
              </motion.li>
            ) : null}
            {quizzes.map((quiz) => (
              <motion.li key={quiz.id} {...ROW_MOTION} className="relative">
                {quiz.id === job.freshQuizId ? (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-primary/10"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 2.4, delay: 0.4, ease: "easeOut" }}
                  />
                ) : null}
                <QuizRow classroomId={classroomId} quiz={quiz} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

/** Creates an on-demand quiz; the new quiz is written in the background. */
function OnDemandTile({ bankSize, job }: { bankSize: number; job: QuizJob }) {
  const t = useTranslations("Classroom.HomePage");
  const tToday = useTranslations("Classroom.TodayQuiz");
  return (
    <div className="editorial-surface flex flex-col justify-between gap-5 rounded-[1.4rem] px-6 py-5">
      <div>
        <p className="eyebrow flex items-center gap-1.5">
          <Sparkles className="size-3" />
          {t("onDemand")}
        </p>
        <h3 className="mt-2 font-heading text-xl font-semibold tracking-[-0.02em]">
          {t("onDemandTitle")}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {bankSize === 0 ? t("onDemandEmpty") : t("onDemandBlurb")}
        </p>
      </div>
      <div>
        <Button
          variant="outline"
          onClick={() => void job.start()}
          disabled={job.busy || bankSize === 0}
        >
          {job.busy ? (
            <>
              <Loader2 className="animate-spin" />
              {tToday("writingTitle")}
            </>
          ) : (
            <>
              <CtaIcon kind="generate" />
              {t("onDemandAction")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** One quiz or exam: its kind, when it was made, and how it went. */
function QuizRow({ classroomId, quiz }: { classroomId: string; quiz: QuizListItem }) {
  const t = useTranslations("Classroom.HomePage");
  const tPage = useTranslations("Classroom.QuizzesPage");
  const locale = useLocale();
  const taken = quiz.attemptCount > 0;
  return (
    <Link
      to={`/classrooms/${classroomId}/quizzes/${quiz.id}${taken ? "" : "/take"}`}
      className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-primary/[0.04] sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{formatQuizDate(quiz.quizDate, locale)}</span>
          <Badge
            variant={
              quiz.kind === "exam" ? "default" : quiz.kind === "manual" ? "warning" : "secondary"
            }
          >
            {quiz.kind === "exam"
              ? tPage("exam")
              : quiz.kind === "manual"
                ? tPage("onDemand")
                : tPage("daily")}
          </Badge>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {tPage("questions", { count: quiz.size })}
          {" · "}
          {taken && quiz.bestScore !== null ? (
            <span className="font-medium text-foreground">
              {tPage("best", { score: quiz.bestScore, size: quiz.size })}
            </span>
          ) : (
            t("notStarted")
          )}
        </span>
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 text-sm font-medium",
          taken ? "text-muted-foreground group-hover:text-foreground" : "text-primary",
        )}
      >
        {taken ? t("review") : t("take")}
        {taken ? (
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        ) : (
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
    </Link>
  );
}

/** The on-demand quiz being written, or why it stopped. */
function JobRow({ job }: { job: QuizJob }) {
  const t = useTranslations("Classroom.TodayQuiz");
  const tHome = useTranslations("Classroom.HomePage");
  const tCommon = useTranslations("Common");

  return (
    <div className="flex items-center gap-3 border-l-2 border-dashed border-primary/50 bg-primary/[0.03] px-4 py-3 sm:px-5">
      {job.busy ? (
        // The modal's writing sheet at about a third of its size.
        <div aria-hidden="true" className="relative size-10 shrink-0 overflow-hidden">
          <QuizWriting className="origin-top-left scale-[0.3]" />
        </div>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {job.busy ? <Loader2 className="size-3.5 animate-spin text-primary" /> : null}
            {job.busy
              ? job.queued
                ? t("stepQueued")
                : t("stepWriting")
              : job.phase === "stopped"
                ? t("stoppedTitle")
                : t("failedTitle")}
          </span>
          <Badge variant="warning">{tHome("onDemand")}</Badge>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {job.busy
            ? job.slow
              ? t("hintLonger")
              : t("writingHint")
            : job.phase === "stopped"
              ? t("stoppedBlurb")
              : t("failedBlurb")}
        </span>
      </span>
      <span className="flex shrink-0 gap-1">
        {job.busy ? (
          <Button variant="ghost" size="sm" onClick={() => void job.cancel()}>
            {tCommon("cancel")}
          </Button>
        ) : (
          <>
            {job.phase === "failed" ? (
              <Button size="sm" onClick={() => void job.start()}>
                {t("tryAgain")}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={job.dismiss}>
              {t("close")}
            </Button>
          </>
        )}
      </span>
    </div>
  );
}

import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "use-intl";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { RECENT_ON_DEMAND_LIMIT } from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import { cn } from "@tmr/ui/utils";
import type { QuizListItem } from "@/spa/lib/queries";
import { PEEK_SPRING } from "@/spa/lib/use-peek";
import { QuizWriting } from "./quiz-writing";
import type { QuizJob } from "./use-quiz-job";

/** Cards slide into place as the row changes; a new one drops in from above. */
const CARD_MOTION = {
  layout: "position" as const,
  initial: { opacity: 0, y: -12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  // A quick fade out, so the spring's bounce never holds a leaving card on screen.
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: "easeOut" as const } },
  transition: PEEK_SPRING,
};

/**
 * One card per on-demand quiz made in the last day, so a quiz that finished
 * while the user was away shows up on the hub. Taken ones keep their card
 * and show the best score. A quiz still being written gets a card first,
 * and the quiz it writes takes that card's place with a short glow.
 */
export function RecentQuizCards({
  classroomId,
  quizzes,
  nowMs,
  job,
}: {
  classroomId: string;
  quizzes: QuizListItem[];
  nowMs: number;
  job: QuizJob;
}) {
  const t = useTranslations("Classroom.HomePage");
  const format = useFormatter();
  const showJob = job.phase !== "idle";
  const shown = showJob ? quizzes.slice(0, RECENT_ON_DEMAND_LIMIT - 1) : quizzes;

  return (
    <ul
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
        !showJob && shown.length === 0 && "hidden",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {showJob ? (
          <motion.li
            key="job"
            {...CARD_MOTION}
            className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-dashed border-primary/35 bg-card/50 px-5 py-5"
            role="status"
            aria-live="polite"
          >
            <JobCard job={job} />
          </motion.li>
        ) : null}
        {shown.map((quiz) => {
          const taken = quiz.attemptCount > 0;
          const fresh = quiz.id === job.freshQuizId;
          return (
            <motion.li
              key={quiz.id}
              {...CARD_MOTION}
              className="editorial-surface relative flex flex-col justify-between gap-4 rounded-2xl px-5 py-5"
            >
              {fresh ? (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 2.4, delay: 0.4, ease: "easeOut" }}
                />
              ) : null}
              <div>
                <p className="eyebrow flex items-center gap-1.5">
                  <Sparkles className="size-3" />
                  {t("onDemand")}
                </p>
                <h2 className="mt-2 font-heading text-xl font-semibold tracking-[-0.02em]">
                  {t("questions", { count: quiz.size })}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("recentMade", { when: format.relativeTime(new Date(quiz.composedAt), nowMs) })}
                  {" · "}
                  {taken && quiz.bestScore !== null
                    ? t("best", { score: quiz.bestScore, size: quiz.size })
                    : t("recentReady")}
                </p>
              </div>
              <div>
                {taken ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/classrooms/${classroomId}/quizzes/${quiz.id}`}>{t("review")}</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link to={`/classrooms/${classroomId}/quizzes/${quiz.id}/take`}>
                      {t("take")}
                      <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/** The inside of the card for the quiz being written, or why it stopped. */
function JobCard({ job }: { job: QuizJob }) {
  const t = useTranslations("Classroom.TodayQuiz");
  const tHome = useTranslations("Classroom.HomePage");
  const tCommon = useTranslations("Common");

  return (
    <>
      {job.busy ? (
        // The modal's writing sheet at half size, tucked into the corner.
        <div className="absolute top-3 right-3 size-16">
          <QuizWriting className="origin-top-left scale-50" />
        </div>
      ) : null}
      <div className={cn(job.busy && "pr-16")}>
        <p className="eyebrow flex items-center gap-1.5">
          <Sparkles className="size-3" />
          {tHome("onDemand")}
        </p>
        <h2 className="mt-2 flex items-center gap-2 font-heading text-xl font-semibold tracking-[-0.02em]">
          {job.busy ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
          {job.busy
            ? job.queued
              ? t("stepQueued")
              : t("stepWriting")
            : job.phase === "stopped"
              ? t("stoppedTitle")
              : t("failedTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {job.busy
            ? job.slow
              ? t("hintLonger")
              : t("writingHint")
            : job.phase === "stopped"
              ? t("stoppedBlurb")
              : t("failedBlurb")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
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
      </div>
    </>
  );
}

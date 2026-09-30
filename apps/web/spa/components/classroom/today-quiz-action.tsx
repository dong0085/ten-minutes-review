import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useRouter } from "@/spa/lib/router";
import { useTranslations } from "use-intl";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import { CtaIcon } from "@tmr/ui/components/cta-icon";
import type { QuizJob } from "./use-quiz-job";
import type { ClassroomOverview } from "@/spa/lib/queries";

/**
 * Today's quiz, plus a button to write one on demand. The new quiz is written
 * in the background and shows up as its own card on the hub, so the user
 * never waits here.
 */
export function TodayQuizAction({
  classroomId,
  dailyQuizId,
  bankSize,
  pendingUploads,
  latestReview,
  minutes,
  paused,
  autoStart = false,
  job,
  resetLocal,
  resetUtc,
  resetTomorrow,
}: {
  classroomId: string;
  dailyQuizId: string | null;
  bankSize: number;
  pendingUploads: number;
  latestReview: ClassroomOverview["latestReview"];
  minutes: number;
  paused: boolean;
  autoStart?: boolean;
  job: QuizJob;
  resetLocal: string;
  resetUtc: string;
  resetTomorrow: boolean;
}) {
  const t = useTranslations("Classroom.TodayQuiz");
  const tLength = useTranslations("Classroom.QuizLength");
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
      router.replace(`/classrooms/${classroomId}`);
    });
    return () => cancelAnimationFrame(frame);
  }, [autoStart, bankSize, classroomId, router, start]);

  const createButton = (
    <Button
      variant={dailyQuizId || latestReview ? "outline" : "default"}
      onClick={() => void start()}
      disabled={job.busy}
    >
      {job.busy ? (
        <>
          <Loader2 className="animate-spin" />
          {t("writingTitle")}
        </>
      ) : (
        <>
          <CtaIcon kind="generate" />
          {t("createNow")}
        </>
      )}
    </Button>
  );

  return (
    <div className="flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Sparkles className="size-3" />
            {t("kicker")}
          </p>
          <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em]">
            {latestReview ? t("completedTitle") : t("title")}
          </h2>
        </div>
        <span
          aria-hidden="true"
          className="font-heading text-4xl font-semibold italic text-primary/25"
        >
          {minutes}′
        </span>
      </div>
      <div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {latestReview
            ? t("completedBlurb")
            : paused
              ? t("paused")
              : dailyQuizId
                ? t("ready")
                : bankSize === 0
                  ? t(pendingUploads > 0 ? "processing" : "empty")
                  : t("idle")}
        </p>
        {!latestReview && bankSize > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {tLength("minutes", { minutes })}
          </p>
        ) : null}
        {!paused && bankSize > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground/80">
            {resetTomorrow
              ? t("resetAtTomorrow", { local: resetLocal, utc: resetUtc })
              : t("resetAt", { local: resetLocal, utc: resetUtc })}
          </p>
        ) : null}
      </div>
      <div>
        {latestReview ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link
                to={`/classrooms/${classroomId}/quizzes/${latestReview.quizId}/attempts/${latestReview.attemptId}`}
              >
                <CtaIcon kind="review" />
                {t("reviewResults")}
              </Link>
            </Button>
            {createButton}
          </div>
        ) : dailyQuizId ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link
                to={`/classrooms/${classroomId}/quizzes/${dailyQuizId}/take`}
              >
                {t("takeToday")}
                <ArrowRight />
              </Link>
            </Button>
            {createButton}
          </div>
        ) : bankSize === 0 ? (
          pendingUploads > 0 ? (
            <Button disabled>
              <Loader2 className="animate-spin" />
              {t("writingTitle")}
            </Button>
          ) : (
            <Button asChild>
              <Link to={`/classrooms/${classroomId}/notes/new`}>
                <CtaIcon kind="notes" />
                {t("addNotes")}
              </Link>
            </Button>
          )
        ) : (
          createButton
        )}
      </div>
    </div>
  );
}

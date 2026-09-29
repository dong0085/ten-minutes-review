import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useRouter } from "@/spa/lib/router";
import { useTranslations } from "use-intl";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import type { QuizJob } from "./use-quiz-job";

/**
 * Today's quiz, plus a button to write one on demand. The new quiz is written
 * in the background and shows up as its own card on the hub, so the user
 * never waits here.
 */
export function TodayQuizAction({
  classroomId,
  dailyQuizId,
  bankSize,
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
  paused: boolean;
  autoStart?: boolean;
  job: QuizJob;
  resetLocal: string;
  resetUtc: string;
  resetTomorrow: boolean;
}) {
  const t = useTranslations("Classroom.TodayQuiz");
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
      variant={dailyQuizId ? "outline" : "default"}
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
          {t("createNow")}
          {dailyQuizId ? null : <ArrowRight />}
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
            {t("title")}
          </h2>
        </div>
        <span aria-hidden="true" className="font-heading text-4xl font-semibold italic text-primary/25">
          10′
        </span>
      </div>
      <div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {paused ? t("paused") : dailyQuizId ? t("ready") : t("idle")}
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
        {dailyQuizId ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link to={`/classrooms/${classroomId}/quizzes/${dailyQuizId}/take`}>
                {t("takeToday")}
                <ArrowRight />
              </Link>
            </Button>
            {createButton}
          </div>
        ) : bankSize === 0 ? (
          <div className="space-y-2">
            <Button disabled>{t("createNow")}</Button>
            <p className="text-xs text-muted-foreground">
              <Link
                className="underline hover:text-foreground"
                to={`/classrooms/${classroomId}/notes/new`}
              >
                {t("addNotes")}
              </Link>{" "}
              {t("addNotesSuffix")}
            </p>
          </div>
        ) : (
          createButton
        )}
      </div>
    </div>
  );
}

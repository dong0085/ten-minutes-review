import { Link } from "react-router";
import { useFormatter, useTranslations } from "use-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import type { QuizListItem } from "@/spa/lib/queries";

/**
 * One card per on-demand quiz made in the last day, so a quiz that finished
 * while the user was away shows up on the hub. Taken ones keep their card
 * and show the best score.
 */
export function RecentQuizCards({
  classroomId,
  quizzes,
  nowMs,
}: {
  classroomId: string;
  quizzes: QuizListItem[];
  nowMs: number;
}) {
  const t = useTranslations("Classroom.HomePage");
  const format = useFormatter();

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {quizzes.map((quiz) => {
        const taken = quiz.attemptCount > 0;
        return (
          <li
            key={quiz.id}
            className="editorial-surface flex flex-col justify-between gap-4 rounded-2xl px-5 py-5"
          >
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
          </li>
        );
      })}
    </ul>
  );
}

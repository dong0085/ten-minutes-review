import { Link, useNavigate, useParams } from "react-router";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { ArrowRight, ChevronRight } from "lucide-react";
import { CATEGORIES, type Category } from "@tmr/core";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { DeleteQuizButton } from "@/components/classroom/delete-quiz-button";
import { PageHeader, SectionTitle } from "@/components/page";
import { FullPageSpinner } from "@/app/shell";
import { formatQuizDate } from "@/lib/format";
import { useQuiz } from "@/lib/queries";
import { ErrorPanel } from "./errors";
import { NotFoundPage } from "./not-found";
import { isNotFound } from "@/lib/api";

/** One quiz: take or retake it, every attempt against it, and what it covers. */
export function QuizDetailPage() {
  const { id, quizId } = useParams() as { id: string; quizId: string };
  const t = useTranslations("App.QuizDetail");
  const tQuizzes = useTranslations("Classroom.QuizzesPage");
  const tAttempt = useTranslations("Classroom.AttemptPage");
  const categoryT = useTranslations("Category");
  const locale = useLocale();
  const format = useFormatter();
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useQuiz(quizId);

  if (isPending) {
    return <FullPageSpinner />;
  }
  if (isNotFound(error) || (data && data.quiz.classroomId !== id)) {
    return <NotFoundPage />;
  }
  if (error || !data) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  const { quiz, attempts } = data;
  const best = attempts.reduce<number | null>(
    (top, attempt) => (top === null ? attempt.correctCount : Math.max(top, attempt.correctCount)),
    null,
  );
  const categories = CATEGORIES.map((category) => ({
    category,
    count: quiz.questions.filter((question) => question.category === category).length,
  })).filter((entry) => entry.count > 0);

  function duration(ms: number) {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0
      ? tAttempt("durationMinutes", { minutes, seconds })
      : tAttempt("durationSeconds", { seconds });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title={formatQuizDate(quiz.quizDate, locale)}
        description={
          <>
            {tQuizzes("questions", { count: quiz.size })}
            {best !== null ? ` · ${tQuizzes("best", { score: best, size: quiz.size })}` : null}
          </>
        }
        actions={
          <>
            <Button asChild>
              <Link to={`/classrooms/${id}/quizzes/${quizId}/take`}>
                {attempts.length === 0 ? t("take") : t("retake")}
                <ArrowRight />
              </Link>
            </Button>
            <DeleteQuizButton
              quizId={quizId}
              onDeleted={() => navigate(`/classrooms/${id}/quizzes`, { replace: true })}
            />
          </>
        }
      />

      <section className="space-y-3">
        <SectionTitle>{t("covers")}</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(({ category, count }) => (
            <Badge key={category} variant="secondary">
              {categoryT(category as Category)} · {count}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>{t("attempts")}</SectionTitle>
        {attempts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-6 text-center text-sm text-muted-foreground">
            {t("noAttempts")}
          </p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/75">
            {attempts.map((attempt) => {
              const ratio = attempt.questionCount > 0 ? attempt.correctCount / attempt.questionCount : 0;
              return (
                <li key={attempt.id}>
                  <Link
                    to={`/classrooms/${id}/quizzes/${quizId}/attempts/${attempt.id}`}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.04] sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {format.dateTime(new Date(attempt.submittedAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {duration(attempt.durationMs)}
                      </span>
                    </span>
                    <Badge variant={ratio >= 0.8 ? "success" : ratio >= 0.5 ? "warning" : "destructive"}>
                      {tAttempt("correct", {
                        correct: attempt.correctCount,
                        total: attempt.questionCount,
                      })}
                    </Badge>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

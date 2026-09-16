import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { getAttemptReview, getClassroom, getQuizForUser } from "@tmr/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionReviewCard } from "@/components/quiz/question-review";
import { formatQuizDate } from "@/lib/format";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  const user = await requireUser({ allowGuest: true });
  const t = await getTranslations("Classroom.AttemptPage");
  const locale = await getLocale();
  const format = await getFormatter();
  const db = getDb();
  const classroom = await getClassroom(db, user.id, id);
  if (!classroom) {
    notFound();
  }
  const review = await getAttemptReview(db, user.id, attemptId);
  if (!review) {
    notFound();
  }
  const quiz = await getQuizForUser(db, user.id, review.attempt.quizId);
  if (!quiz || quiz.classroomId !== id) {
    notFound();
  }
  const scorePercent =
    review.attempt.questionCount > 0
      ? Math.round((review.attempt.correctCount / review.attempt.questionCount) * 100)
      : 0;
  const scoreTone = scorePercent >= 80 ? "success" : scorePercent >= 50 ? "warning" : "destructive";

  function formatDuration(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0
      ? t("durationMinutes", { minutes, seconds })
      : t("durationSeconds", { seconds });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          href={`/classrooms/${id}/quizzes`}
        >
          {t("allQuizzes")}
        </Link>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{classroom.name}</p>
      </div>
      <Card className="relative overflow-hidden border-primary/15 bg-primary/[0.04]">
        <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-primary/30" />
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-3xl font-semibold tracking-[-0.025em]">
                {t("correct", {
                  correct: review.attempt.correctCount,
                  total: review.attempt.questionCount,
                })}
              </h2>
              <Badge variant={scoreTone}>{scorePercent}%</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatQuizDate(quiz.quizDate, locale)} · {formatDuration(review.attempt.durationMs)}{" "}
              ·{" "}
              {t("submitted", {
                when: format.dateTime(review.attempt.submittedAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/classrooms/${id}/quiz/${quiz.id}`}>{t("retake")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/classrooms/${id}?create=1`}>{t("createAnother")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/classrooms/${id}/quizzes`}>{t("allQuizzesButton")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      {review.answers.map((answer) => (
        <QuestionReviewCard
          key={answer.questionId}
          question={{
            position: answer.position,
            category: answer.category,
            type: answer.type,
            stem: answer.stem,
            options: answer.options,
          }}
          response={answer.response}
          correctAnswer={answer.answer}
          isCorrect={answer.isCorrect}
          explanation={answer.explanation}
        />
      ))}
    </div>
  );
}

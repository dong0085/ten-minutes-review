import { Link, useParams } from "react-router";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { paperParts, partNumeral } from "@tmr/core";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { ExamReviewPanel } from "@/spa/components/quiz/exam-review";
import { QuestionReviewCard } from "@/spa/components/quiz/question-review";
import { LessonSources } from "@/spa/components/lesson-sources";
import { FullPageSpinner } from "@/spa/app/shell";
import { isNotFound } from "@/spa/lib/api";
import { formatQuizDate } from "@/spa/lib/format";
import { useAttempt, useQuiz } from "@/spa/lib/queries";
import { ErrorPanel } from "./errors";
import { NotFoundPage } from "./not-found";

export function AttemptPage() {
  const { id, quizId, attemptId } = useParams() as {
    id: string;
    quizId: string;
    attemptId: string;
  };
  const t = useTranslations("Classroom.AttemptPage");
  const tPaper = useTranslations("Quiz.Paper");
  const locale = useLocale();
  const format = useFormatter();
  const { data: quizData } = useQuiz(quizId);
  const { data: review, isPending, error, refetch } = useAttempt(attemptId);

  if (isPending) {
    return <FullPageSpinner />;
  }
  if (isNotFound(error) || (review && review.attempt.quizId !== quizId)) {
    return <NotFoundPage />;
  }
  if (error || !review) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  const { attempt } = review;
  const scorePercent =
    attempt.questionCount > 0
      ? Math.round((attempt.correctCount / attempt.questionCount) * 100)
      : 0;
  const scoreTone =
    scorePercent >= 80
      ? "success"
      : scorePercent >= 50
        ? "warning"
        : "destructive";
  const totalSeconds = Math.round(attempt.durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const duration =
    minutes > 0
      ? t("durationMinutes", { minutes, seconds })
      : t("durationSeconds", { seconds });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="relative overflow-hidden border-primary/15 bg-primary/[0.04]">
        <div
          aria-hidden="true"
          className="absolute inset-x-10 top-0 h-px bg-primary/30"
        />
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow mb-2">{t("completed")}</p>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-3xl font-semibold tracking-[-0.025em]">
                {t("correct", {
                  correct: attempt.correctCount,
                  total: attempt.questionCount,
                })}
              </h1>
              <Badge variant={scoreTone}>{scorePercent}%</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {quizData
                ? `${formatQuizDate(quizData.quiz.quizDate, locale)} · `
                : null}
              {duration} ·{" "}
              {t("submitted", {
                when: format.dateTime(new Date(attempt.submittedAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              {t("completedBlurb")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={`/classrooms/${id}/quizzes/${quizId}/take`}>
                {t("retake")}
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/classrooms/${id}`}>{t("finish")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      {quizData ? (
        <LessonSources classroomId={id} sources={quizData.quiz.sources} />
      ) : null}
      {quizData?.quiz.kind === "exam" ? (
        <ExamReviewPanel
          attemptId={attemptId}
          onJump={(number) =>
            document
              .getElementById(`question-${number}`)
              ?.scrollIntoView({ block: "start", behavior: "smooth" })
          }
        />
      ) : null}
      {paperParts(review.answers).map((part) => (
        <section key={part.section} className="space-y-4">
          <h2 className="flex flex-wrap items-baseline gap-x-2 pt-3 font-heading text-lg font-semibold">
            {tPaper("part", {
              numeral: partNumeral(tPaper("numerals"), part.partNumber),
              title: tPaper(part.section),
            })}
            <span className="text-sm font-normal text-muted-foreground">
              {tPaper("partCount", { count: part.questions.length })}
            </span>
          </h2>
          {part.questions.map(({ question: answer, number }) => (
            <div
              key={answer.questionId}
              id={`question-${number}`}
              className="scroll-mt-6"
            >
              <QuestionReviewCard
                classroomId={id}
                question={{
                  position: number,
                  category: answer.category,
                  type: answer.type,
                  stem: answer.stem,
                  options: answer.options,
                  knowledgePointId: answer.knowledgePointId,
                  isKnowledgePointRetired: answer.isKnowledgePointRetired,
                }}
                response={answer.response}
                correctAnswer={answer.correctAnswer}
                isCorrect={answer.isCorrect}
                explanation={answer.explanation}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

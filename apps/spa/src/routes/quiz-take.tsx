import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "use-intl";
import { X } from "lucide-react";
import { EXAM_MINUTES, isQuizLength, QUIZ_LENGTH_MINUTES } from "@tmr/core";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { FullPageSpinner } from "@/app/shell";
import { isNotFound } from "@/lib/api";
import { formatQuizDate } from "@/lib/format";
import { keys, useClassroom, useQuiz } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { NotFoundPage } from "./not-found";

/** Full-screen focus mode: no top bar, one way out. */
export function TakeQuizPage() {
  const { id, quizId } = useParams() as { id: string; quizId: string };
  const t = useTranslations("Classroom.QuizPage");
  const tShell = useTranslations("App.Shell");
  const tPaper = useTranslations("Quiz.Paper");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { data, isPending, error } = useQuiz(quizId);
  const { data: classroom } = useClassroom(id);

  // A submitted attempt changes scores on the quiz, the list, and the hub.
  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: keys.quiz(quizId) });
      void queryClient.invalidateQueries({ queryKey: ["classroom", id] });
      void queryClient.invalidateQueries({ queryKey: keys.classrooms });
    },
    [id, quizId, queryClient],
  );

  if (isPending || !session) {
    return <FullPageSpinner />;
  }
  if (isNotFound(error) || !data || data.quiz.classroomId !== id) {
    return <NotFoundPage />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Link
          to={`/classrooms/${id}/quizzes/${quizId}`}
          aria-label={tShell("closeQuiz")}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </Link>
      </div>
      <QuizRunner
        quizId={quizId}
        classroomId={id}
        userId={session.user.id}
        title={data.quiz.classroomName}
        subtitle={
          data.quiz.kind === "exam"
            ? tPaper("examSubtitle", { date: formatQuizDate(data.quiz.quizDate, locale) })
            : formatQuizDate(data.quiz.quizDate, locale)
        }
        kind={data.quiz.kind}
        candidateName={session.user.username ?? session.user.email.split("@")[0] ?? ""}
        instructions={t("note", { count: data.quiz.size })}
        suggestedMinutes={
          data.quiz.kind === "exam"
            ? EXAM_MINUTES
            : classroom && isQuizLength(classroom.quizLength)
              ? QUIZ_LENGTH_MINUTES[classroom.quizLength]
              : undefined
        }
      />
    </div>
  );
}

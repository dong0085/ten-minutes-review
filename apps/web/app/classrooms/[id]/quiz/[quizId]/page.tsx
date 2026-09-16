import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getQuizWithQuestionsForUser } from "@tmr/db";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { formatQuizDate } from "@/lib/format";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string }>;
}) {
  const { id, quizId } = await params;
  const user = await requireUser({ allowGuest: true });
  const t = await getTranslations("Classroom.QuizPage");
  const locale = await getLocale();
  const data = await getQuizWithQuestionsForUser(getDb(), user.id, quizId);
  if (!data || data.quiz.classroomId !== id) {
    notFound();
  }
  return (
    <div className="space-y-7">
      <div className="mx-auto max-w-3xl">
        <Link
          className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          href={`/classrooms/${id}/quizzes`}
        >
          {t("allQuizzes")}
        </Link>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {formatQuizDate(data.quiz.quizDate, locale)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("note", { count: data.quiz.size })}
        </p>
      </div>
      <QuizRunner quizId={quizId} classroomId={id} userId={user.id} />
    </div>
  );
}

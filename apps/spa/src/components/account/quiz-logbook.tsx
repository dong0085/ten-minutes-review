import { useTranslations } from "use-intl";
import { SectionTitle } from "@/components/account/account-header";
import { Logbook, LogbookRow } from "@/components/logbook";

type LogbookQuiz = {
  id: string;
  classroomId: string;
  classroomName: string;
  quizDate: string;
  size: number;
  bestScore: number | null;
  attemptCount: number;
};

// Recent quizzes across all classrooms, as a ruled logbook.
export function QuizLogbook({
  quizzes,
  hasMore,
  limit,
}: {
  quizzes: LogbookQuiz[];
  hasMore: boolean;
  limit: number;
}) {
  const t = useTranslations("Account");

  return (
    <section className="editorial-surface overflow-hidden rounded-[1.6rem]">
      <div className="px-6 pt-6 pb-4 sm:px-8">
        <SectionTitle kicker={t("Logbook.kicker")} title={t("quizHistorySection")} />
      </div>
      {quizzes.length === 0 ? (
        <p className="logbook border-t border-border/70 py-6 pr-6 pl-[5.25rem] text-sm text-muted-foreground">
          {t("noQuizzes")}
        </p>
      ) : (
        <Logbook className="border-t border-border/70">
          {quizzes.map((quiz) => (
            <LogbookRow
              key={quiz.id}
              href={`/classrooms/${quiz.classroomId}/quizzes/${quiz.id}`}
              quizDate={quiz.quizDate}
              title={<span className="truncate">{quiz.classroomName}</span>}
              meta={
                <>
                  {t("quizQuestions", { count: quiz.size })} · {t("attempts", { count: quiz.attemptCount })}
                </>
              }
              score={quiz.bestScore}
              size={quiz.size}
              pending={t("Logbook.notTaken")}
            />
          ))}
        </Logbook>
      )}
      {hasMore ? (
        <p className="border-t border-border/70 px-6 py-3 text-xs text-muted-foreground sm:px-8">
          {t("quizHistoryMore", { count: limit })}
        </p>
      ) : null}
    </section>
  );
}

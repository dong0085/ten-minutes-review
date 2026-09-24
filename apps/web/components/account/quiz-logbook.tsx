import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { SectionTitle } from "@/components/account/account-header";
import { cn } from "@/lib/utils";

type LogbookQuiz = {
  id: string;
  classroomId: string;
  classroomName: string;
  quizDate: string;
  size: number;
  bestScore: number | null;
  attemptCount: number;
};

// Recent quizzes as a ruled logbook: the date sits in the margin, the best
// score is circled on the right.
export async function QuizLogbook({
  quizzes,
  hasMore,
  limit,
}: {
  quizzes: LogbookQuiz[];
  hasMore: boolean;
  limit: number;
}) {
  const t = await getTranslations("Account");
  const format = await getFormatter();

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
        <ol className="logbook border-t border-border/70">
          {quizzes.map((quiz) => {
            // quizDate is a calendar day, so format it in UTC to keep the same day.
            const day = new Date(`${quiz.quizDate}T00:00:00Z`);
            const ratio = quiz.bestScore !== null && quiz.size > 0 ? quiz.bestScore / quiz.size : null;
            return (
              <li key={quiz.id} className="border-b border-primary/10 last:border-b-0">
                <Link
                  href={`/classrooms/${quiz.classroomId}/quiz/${quiz.id}`}
                  className="group flex items-center gap-4 py-3 pr-4 transition-colors hover:bg-primary/[0.04] sm:pr-6"
                >
                  <span className="flex w-[4.25rem] shrink-0 flex-col items-center leading-none">
                    <span className="font-heading text-2xl font-semibold tabular-nums">
                      {format.dateTime(day, { day: "numeric", timeZone: "UTC" })}
                    </span>
                    <span className="mt-1 text-[0.62rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {format.dateTime(day, { month: "short", timeZone: "UTC" })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 pl-2">
                    <span className="block truncate font-medium">{quiz.classroomName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {format.dateTime(day, { weekday: "long", timeZone: "UTC" })} ·{" "}
                      {t("quizQuestions", { count: quiz.size })} · {t("attempts", { count: quiz.attemptCount })}
                    </span>
                  </span>
                  {ratio !== null ? (
                    <span
                      className={cn(
                        "marker-loop shrink-0 px-1.5 font-heading text-lg font-semibold tabular-nums",
                        ratio >= 0.8 ? "text-success" : ratio >= 0.6 ? "text-primary" : "text-warning",
                      )}
                    >
                      {quiz.bestScore}/{quiz.size}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {t("Logbook.notTaken")}
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {hasMore ? (
        <p className="border-t border-border/70 px-6 py-3 text-xs text-muted-foreground sm:px-8">
          {t("quizHistoryMore", { count: limit })}
        </p>
      ) : null}
    </section>
  );
}

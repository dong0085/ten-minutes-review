import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { getClassroom, listQuizzesForClassroom } from "@tmr/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DeleteQuizButton } from "@/components/classroom/delete-quiz-button";
import { formatQuizDate } from "@/lib/format";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function QuizzesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ allowGuest: true });
  const t = await getTranslations("Classroom.QuizzesPage");
  const locale = await getLocale();
  const db = getDb();
  const classroom = await getClassroom(db, user.id, id);
  if (!classroom) {
    notFound();
  }
  const quizzes = await listQuizzesForClassroom(db, user.id, id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("blurb")}</p>
      </div>
      {quizzes.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileQuestion />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("empty")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/classrooms/${id}/upload`}>{t("addNotes")}</Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/75 p-4 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.035)] transition hover:-translate-y-px hover:border-primary/15 hover:bg-card"
            >
              <Link
                href={`/classrooms/${id}/quiz/${quiz.id}`}
                className="flex flex-1 items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{formatQuizDate(quiz.quizDate, locale)}</p>
                    <Badge variant={quiz.kind === "manual" ? "warning" : "secondary"}>
                      {quiz.kind === "manual" ? t("onDemand") : t("daily")}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("questions", { count: quiz.size })}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {quiz.bestScore !== null ? (
                    <p className="font-medium text-foreground">
                      {t("best", { score: quiz.bestScore, size: quiz.size })}
                    </p>
                  ) : (
                    <p>{t("notAttempted")}</p>
                  )}
                  <p>{t("attempts", { count: quiz.attemptCount })}</p>
                </div>
              </Link>
              <DeleteQuizButton quizId={quiz.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

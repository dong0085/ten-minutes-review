import { Link, useParams } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ChevronRight, FileQuestion } from "lucide-react";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@tmr/ui/components/empty";
import { PageHeader } from "@/components/page";
import { FullPageSpinner } from "@/app/shell";
import { formatQuizDate } from "@/lib/format";
import { useQuizzes } from "@/lib/queries";
import { ErrorPanel } from "./errors";

export function QuizzesPage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations("Classroom.QuizzesPage");
  const locale = useLocale();
  const { data: quizzes, isPending, error, refetch } = useQuizzes(id);

  if (isPending) {
    return <FullPageSpinner />;
  }
  if (error || !quizzes) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("blurb")} />
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
                  <Link to={`/classrooms/${id}/notes/new`}>{t("addNotes")}</Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/75">
          {quizzes.map((quiz) => (
            <li key={quiz.id}>
              <Link
                to={`/classrooms/${id}/quizzes/${quiz.id}`}
                className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-primary/[0.04] sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{formatQuizDate(quiz.quizDate, locale)}</span>
                    <Badge variant={quiz.kind === "manual" ? "warning" : "secondary"}>
                      {quiz.kind === "manual" ? t("onDemand") : t("daily")}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t("questions", { count: quiz.size })} ·{" "}
                    {t("attempts", { count: quiz.attemptCount })}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {quiz.bestScore !== null ? (
                    <span className="font-medium text-foreground">
                      {t("best", { score: quiz.bestScore, size: quiz.size })}
                    </span>
                  ) : (
                    t("notAttempted")
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

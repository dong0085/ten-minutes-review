import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "use-intl";
import { CircleCheckBig, Loader2, NotebookText, RotateCcw } from "lucide-react";
import { CATEGORIES, MISTAKE_WINDOW_DAYS, shuffledIndexOrder, type Category } from "@tmr/core";
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
import { Progress } from "@tmr/ui/components/progress";
import { BillingButton } from "@/components/account/billing-button";
import { PageHeader } from "@/components/page";
import {
  isAnswered,
  QuestionSheetItem,
  type QuestionGrade,
} from "@/components/quiz/question-sheet-item";
import type { LocalResponse, QuizQuestion } from "@/components/quiz/types";
import { FullPageSpinner } from "@/app/shell";
import { api } from "@/lib/api";
import { formatQuizDate } from "@/lib/format";
import { keys, useMistakes, type Mistake } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { ErrorPanel } from "./errors";

type Entry = {
  response: LocalResponse | undefined;
  grade: QuestionGrade | undefined;
  checking: boolean;
  error: boolean;
};

const EMPTY_ENTRY: Entry = { response: undefined, grade: undefined, checking: false, error: false };

/**
 * The classroom's mistake book: every question missed in the window, oldest
 * first, answered one at a time. A right answer clears it; a wrong one keeps
 * the red-pen note on the page and offers another go.
 */
export function MistakeBookPage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations("Classroom.MistakeBook");
  const { data: session } = useSession();
  const isPaid = session?.plan.isPaid ?? false;
  const { data, isPending, error, refetch } = useMistakes(id, isPaid);

  if (!session) {
    return <FullPageSpinner />;
  }
  if (!isPaid) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <NotebookText />
                </EmptyMedia>
                <EmptyTitle>{t("proTitle")}</EmptyTitle>
                <EmptyDescription>{t("proBlurb", { days: MISTAKE_WINDOW_DAYS })}</EmptyDescription>
              </EmptyHeader>
              {session.features.billing ? (
                <EmptyContent>
                  <BillingButton action="checkout" />
                </EmptyContent>
              ) : null}
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (isPending) {
    return <FullPageSpinner />;
  }
  if (error || !data) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  // Keyed on the fetch, so a refetch after corrections starts a fresh sheet.
  return <MistakeSheet key={data.mistakes.map((m) => m.question.id).join()} classroomId={id} {...data} />;
}

function MistakeSheet({
  classroomId,
  windowDays,
  mistakes,
}: {
  classroomId: string;
  windowDays: number;
  mistakes: Mistake[];
}) {
  const t = useTranslations("Classroom.MistakeBook");
  const categoryT = useTranslations("Category");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  // Options come in a fresh order, so a remembered letter is no help.
  const [optionOrders] = useState(() =>
    Object.fromEntries(
      mistakes.map((mistake) => [
        mistake.question.id,
        shuffledIndexOrder(mistake.question.options?.length ?? 0),
      ]),
    ),
  );

  const corrected = mistakes.filter((mistake) => entries[mistake.question.id]?.grade?.isCorrect).length;

  const update = (questionId: string, patch: Partial<Entry>) =>
    setEntries((previous) => ({
      ...previous,
      [questionId]: { ...EMPTY_ENTRY, ...previous[questionId], ...patch },
    }));

  async function check(questionId: string) {
    const response = entries[questionId]?.response;
    update(questionId, { checking: true, error: false });
    try {
      const result = await api.post<Omit<QuestionGrade, "questionId">>(
        `/api/classrooms/${classroomId}/mistakes/${questionId}`,
        { response: response ?? {} },
      );
      update(questionId, { checking: false, grade: { questionId, ...result } });
      if (result.isCorrect) {
        void queryClient.invalidateQueries({ queryKey: keys.overview(classroomId) });
      }
    } catch {
      update(questionId, { checking: false, error: true });
    }
  }

  if (mistakes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("blurb", { days: windowDays })} />
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CircleCheckBig />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyBlurb", { days: windowDays })}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("blurb", { days: windowDays })} />
      <div className="sticky top-17 z-10 flex items-center gap-3 rounded-2xl border border-border/75 bg-background/85 px-4 py-2.5 shadow-[0_10px_36px_rgb(var(--shadow-colour)/0.08)] backdrop-blur-xl sm:top-19">
        <p className="shrink-0 text-sm font-medium tabular-nums">
          {t("progress", { done: corrected, total: mistakes.length })}
        </p>
        <Progress value={(corrected / mistakes.length) * 100} className="h-1.5" />
      </div>

      <article className="mistake-book">
        <ol className="space-y-10">
          {mistakes.map((mistake, index) => {
            const questionId = mistake.question.id;
            const entry = entries[questionId] ?? EMPTY_ENTRY;
            const question: QuizQuestion = { ...mistake.question, position: index };
            const category = mistake.question.category;
            const kind =
              mistake.source.kind === "exam"
                ? t("kindExam")
                : mistake.source.kind === "manual"
                  ? t("kindManual")
                  : t("kindDaily");
            const right = entry.grade?.isCorrect === true;
            return (
              <QuestionSheetItem
                key={questionId}
                ref={() => {}}
                kicker={
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Link
                      to={`/classrooms/${classroomId}/quizzes/${mistake.source.quizId}`}
                      className="underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {t("source", { date: formatQuizDate(mistake.source.quizDate, locale), kind })}
                    </Link>
                    <span aria-hidden="true">·</span>
                    <span className="text-destructive">{t("missCount", { count: mistake.missCount })}</span>
                  </p>
                }
                question={question}
                number={index + 1}
                isLast={index === mistakes.length - 1}
                response={entry.response}
                optionOrder={optionOrders[questionId]}
                categoryLabel={
                  CATEGORIES.includes(category as Category) ? categoryT(category) : category
                }
                pointId={undefined}
                isOmitted={false}
                grade={entry.grade}
                markOrder={1}
                onAnswer={(response) => update(questionId, { response, error: false })}
                onActivate={() => {}}
                onAdvance={() => {
                  if (!entry.grade && isAnswered(question, entry.response)) {
                    void check(questionId);
                  }
                }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  {!entry.grade ? (
                    <Button
                      size="sm"
                      disabled={entry.checking || !isAnswered(question, entry.response)}
                      onClick={() => void check(questionId)}
                    >
                      {entry.checking ? <Loader2 className="animate-spin" /> : null}
                      {entry.checking ? t("checking") : t("check")}
                    </Button>
                  ) : right ? (
                    <span className="mistake-stamp quiz-mark">{t("corrected")}</span>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => update(questionId, { grade: undefined, response: undefined })}
                      >
                        <RotateCcw />
                        {t("tryAgain")}
                      </Button>
                      <span className="text-sm text-muted-foreground">{t("stillWrong")}</span>
                    </>
                  )}
                  {entry.error ? (
                    <span role="alert" className="text-sm text-destructive">
                      {t("checkError")}
                    </span>
                  ) : null}
                </div>
              </QuestionSheetItem>
            );
          })}
        </ol>
        {corrected === mistakes.length ? (
          <div className="mt-12 text-center">
            <p className="font-heading text-xl font-semibold">{t("allDoneTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("allDoneBlurb")}</p>
          </div>
        ) : null}
      </article>
    </div>
  );
}

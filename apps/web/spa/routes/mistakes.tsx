import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
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
import { BillingButton } from "@/spa/components/account/billing-button";
import { PageHeader } from "@/spa/components/page";
import {
  isAnswered,
  QuestionSheetItem,
  type QuestionGrade,
} from "@/spa/components/quiz/question-sheet-item";
import { MarksStart, ScoreStamp } from "@/spa/components/quiz/marks";
import { TutorPanel } from "@/spa/components/quiz/tutor-panel";
import type { LocalResponse, QuizQuestion } from "@/spa/components/quiz/types";
import { FullPageSpinner } from "@/spa/app/shell";
import { api } from "@/spa/lib/api";
import { formatQuizDate } from "@/spa/lib/format";
import { keys, useMistakes, type Mistake } from "@/spa/lib/queries";
import { useSession } from "@/spa/lib/session";
import { ErrorPanel } from "./errors";

type Entry = {
  response: LocalResponse | undefined;
  grade: QuestionGrade | undefined;
  gradedAt: string | null;
  checking: boolean;
  error: boolean;
  /** A corrected question folds down to one crossed-out line. */
  folded: boolean;
};

const EMPTY_ENTRY: Entry = {
  response: undefined,
  grade: undefined,
  gradedAt: null,
  checking: false,
  error: false,
  folded: false,
};

/** How long a corrected question stays open, so its stamp and note can be read. */
const FOLD_AFTER_MS = 1800;
const FOLD = { type: "spring", stiffness: 260, damping: 30 } as const;

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
      update(questionId, {
        checking: false,
        grade: { questionId, ...result },
        gradedAt: new Date().toISOString(),
      });
      if (result.isCorrect) {
        setTimeout(() => update(questionId, { folded: true }), FOLD_AFTER_MS);
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
        <MarksStart value={0.05}>
          <ol>
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
              const folded = right && entry.folded;
              return (
                <motion.li
                  key={questionId}
                  initial={false}
                  animate={{ marginTop: index === 0 ? 0 : folded ? 12 : 40 }}
                  transition={FOLD}
                >
                  <AnimatePresence initial={false} mode="wait">
                    {folded ? (
                      <motion.button
                        key="folded"
                        type="button"
                        aria-label={t("reopen")}
                        title={t("reopen")}
                        onClick={() => update(questionId, { folded: false })}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={FOLD}
                        className="flex w-full items-center gap-3 overflow-hidden rounded-lg text-left text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="w-7 shrink-0 text-right font-heading leading-8 tabular-nums">
                          {index + 1}.
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="relative inline-block max-w-full truncate align-middle font-heading">
                            {question.stem}
                            <motion.span
                              aria-hidden="true"
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ delay: 0.2, duration: 0.35, ease: [0.3, 0, 0.2, 1] }}
                              className="absolute inset-x-0 top-1/2 h-0.5 origin-left rounded-full bg-destructive/70"
                            />
                          </span>
                        </span>
                        <span className="mistake-stamp shrink-0 text-xs">{t("corrected")}</span>
                      </motion.button>
                    ) : (
                      <motion.div
                        key="open"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={FOLD}
                        // Room for marks that hang over the edge while the height is clipped.
                        className="-m-3 overflow-hidden p-3"
                      >
                        <QuestionSheetItem
                          as="div"
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
                              <ScoreStamp after={1} tilt={0} className="mistake-stamp">
                                {t("corrected")}
                              </ScoreStamp>
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
                          <TutorPanel
                            classroomId={classroomId}
                            questionId={questionId}
                            initial={mistake.tutor}
                            wrongResponse={entry.grade && !right ? (entry.response ?? {}) : null}
                            wrongAt={entry.grade && !right ? entry.gradedAt : null}
                            corrected={right}
                          />
                        </QuestionSheetItem>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ol>
        </MarksStart>
        {corrected === mistakes.length ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...FOLD, delay: FOLD_AFTER_MS / 1000 + 0.3 }}
            className="mt-12 text-center"
          >
            <p className="font-heading text-xl font-semibold">{t("allDoneTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("allDoneBlurb")}</p>
          </motion.div>
        ) : null}
      </article>
    </div>
  );
}

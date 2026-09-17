import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Clock3, FileText, Image as ImageIcon, NotebookPen } from "lucide-react";
import {
  bankSize,
  countBankByCategory,
  getClassroom,
  getDailyQuizByClassroomAndDate,
  getLatestComposeJob,
  listQuizzesForClassroom,
  listUntakenOnDemandQuizzes,
  listUploadsForUser,
} from "@tmr/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BankSummary } from "@/components/classroom/bank-summary";
import { TodayQuizAction } from "@/components/classroom/today-quiz-action";
import { formatQuizDate } from "@/lib/format";
import { getDb } from "@/lib/db";
import { formatResetTime } from "@/lib/send-time";
import { getCurrentUserOrGuest } from "@/lib/session";

const REHYDRATE_WINDOW_MS = 10 * 60 * 1000;

function localDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function firstLine(value: string | null, fallback: string): string {
  const line = (value ?? "").split("\n").find((entry) => entry.trim() !== "");
  return line?.trim() ?? fallback;
}

function nowMs(): number {
  return new Date().getTime();
}

export default async function ClassroomHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { create } = await searchParams;
  const current = await getCurrentUserOrGuest();
  if (!current) {
    notFound();
  }
  const { user, isGuest } = current;
  const t = await getTranslations("Classroom.HomePage");
  const locale = await getLocale();
  const format = await getFormatter();
  const reset = formatResetTime(locale, user.timezone);
  const db = getDb();
  const classroom = await getClassroom(db, user.id, id);
  if (!classroom) {
    notFound();
  }

  const today = localDate(user.timezone);
  const [counts, size, dailyQuiz, uploads, quizzes, unfinished, composeJob] =
    await Promise.all([
      countBankByCategory(db, user.id, classroom.id),
      bankSize(db, classroom.id),
      getDailyQuizByClassroomAndDate(db, classroom.id, today),
      listUploadsForUser(db, user.id, classroom.id),
      listQuizzesForClassroom(db, user.id, classroom.id),
      listUntakenOnDemandQuizzes(db, classroom.id, 3),
      getLatestComposeJob(db, classroom.id, REHYDRATE_WINDOW_MS),
    ]);
  const recent = uploads.slice(0, 3);
  const recentQuizzes = quizzes.slice(0, 5);

  return (
    <div className="space-y-5">
      {isGuest ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:px-5">
          <p className="text-sm font-medium text-foreground/90">{t("guestBanner")}</p>
          <Button asChild size="sm">
            <Link href="/signup">
              {t("guestBannerAction")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="paper-lines relative border-primary/15 bg-primary/[0.055] lg:col-span-3">
          <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-primary/25" />
          <CardContent className="relative">
            {isGuest ? (
              <div className="flex flex-1 flex-col justify-between gap-4 py-2">
                <div>
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/[0.08] text-primary">
                    <Clock3 className="size-4.5" />
                  </span>
                  <p className="eyebrow mt-5">{t("guestDailyQuizTitle")}</p>
                  <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.025em]">
                    {t("guestDailyQuizTitle")}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    {t("guestDailyQuizBlurb")}
                  </p>
                </div>
                <div className="pt-3">
                  <Button asChild size="lg">
                    <Link href="/signup">
                      {t("guestDailyQuizCta")}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <TodayQuizAction
                classroomId={classroom.id}
                dailyQuizId={dailyQuiz?.id ?? null}
                bankSize={size}
                paused={classroom.pausedAt !== null}
                nowMs={nowMs()}
                autoStart={create === "1"}
                resetLocal={reset.local}
                resetUtc={reset.utc}
                resetTomorrow={reset.tomorrow}
                initialJob={
                  composeJob
                    ? {
                        status: composeJob.status as "pending" | "running",
                        requestedAt: composeJob.createdAt.toISOString(),
                      }
                    : null
                }
              />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <div>
              <span className="grid size-10 place-items-center rounded-xl bg-primary/[0.08] text-primary">
                <NotebookPen className="size-4.5" />
              </span>
              <h2 className="mt-6 font-heading text-2xl font-semibold tracking-[-0.025em]">
                {t("addNotesTitle")}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {t("addNotesBlurb")}
              </p>
            </div>
            <div>
              <Button asChild variant="outline" className="justify-between">
                <Link href={`/classrooms/${classroom.id}/upload`}>
                  {t("addNotes")}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/70">
        <CardContent>
          <BankSummary counts={counts} />
        </CardContent>
      </Card>

      <Card className="bg-card/70">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock3 className="size-4 text-primary" />
              <h2 className="font-heading text-xl font-semibold">{t("recentUploads")}</h2>
            </div>
            <Link className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground" href={`/classrooms/${classroom.id}/history`}>
              {t("viewHistory")}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noUploads")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map(({ upload }) => (
                <li key={upload.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      {upload.kind === "text" ? <FileText className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                    </span>
                    <div className="min-w-0">
                    <p className="truncate text-sm">
                      {upload.subject ??
                        (upload.kind === "text"
                          ? firstLine(upload.textContent, t("textNotes"))
                          : (upload.originalFilename ?? t("imageNotes")))}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format.dateTime(upload.createdAt, { dateStyle: "medium" })}
                    </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {upload.kind === "text" ? t("text") : t("image")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={unfinished.length === 0 ? "bg-card/70 md:col-span-2" : "bg-card/70"}>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-xl font-semibold">{t("recentQuizzes")}</h2>
              <Link className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground" href={`/classrooms/${classroom.id}/quizzes`}>
                {t("viewAll")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {recentQuizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noQuizzes")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentQuizzes.map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      href={`/classrooms/${classroom.id}/quiz/${quiz.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-muted/70"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {formatQuizDate(quiz.quizDate, locale)}
                          </p>
                          <Badge variant={quiz.kind === "manual" ? "warning" : "secondary"}>
                            {quiz.kind === "manual" ? t("onDemand") : t("daily")}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("questions", { count: quiz.size })}
                        </p>
                      </div>
                      {quiz.attemptCount === 0 ? (
                        <span className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground">
                          {t("take")}
                        </span>
                      ) : (
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {t("best", { score: quiz.bestScore ?? 0, size: quiz.size })}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {unfinished.length > 0 ? (
          <Card className="border-primary/12 bg-primary/[0.035]">
            <CardContent className="space-y-3">
              <div>
                <h2 className="font-heading text-xl font-semibold">{t("unfinished")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("unfinishedBlurb")}</p>
              </div>
              <ul className="divide-y divide-border">
                {unfinished.map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      href={`/classrooms/${classroom.id}/quiz/${quiz.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-muted/70"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {formatQuizDate(quiz.quizDate, locale)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("questions", { count: quiz.size })}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground">
                        {t("take")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Check, Clock3, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { BankSummary } from "@/components/classroom/bank-summary";
import { TodayQuizAction } from "@/components/classroom/today-quiz-action";
import { Logbook, LogbookRow } from "@/components/logbook";
import { PencilIcon } from "@/components/pencil-icon";
import { formatQuizDate } from "@/lib/format";
import { getDb } from "@/lib/db";
import { formatResetTime } from "@/lib/send-time";
import { getCurrentUserOrGuest } from "@/lib/session";
import { cn } from "@/lib/utils";

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
  // Today's date in the user's timezone, printed on the desk calendar leaf.
  const leaf = new Date(`${today}T00:00:00Z`);

  return (
    <div className="space-y-10">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Today's quiz on a tear-off desk calendar. */}
        <section className="editorial-surface grid overflow-hidden rounded-[1.6rem] sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="relative flex items-center justify-center border-b border-border/70 bg-muted/40 px-6 py-7 sm:border-r sm:border-b-0">
            <div className="relative w-28 rotate-[-2deg] rounded-xl bg-card text-center shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.06),0_12px_24px_rgb(var(--shadow-colour)/0.1)] transition-transform duration-300 hover:rotate-0">
              {/* Binding rings. */}
              <span aria-hidden="true" className="absolute -top-2 left-0 flex w-full justify-around px-5">
                <span className="h-4 w-1.5 rounded-full border border-foreground/25 bg-background" />
                <span className="h-4 w-1.5 rounded-full border border-foreground/25 bg-background" />
              </span>
              <p className="rounded-t-xl bg-primary py-1.5 text-[0.68rem] font-bold tracking-[0.18em] text-primary-foreground uppercase">
                {format.dateTime(leaf, { month: "short", timeZone: "UTC" })}
              </p>
              <p className="pt-1 font-heading text-5xl leading-tight font-semibold tabular-nums">
                {format.dateTime(leaf, { day: "numeric", timeZone: "UTC" })}
              </p>
              <p className="border-t border-dashed border-border pt-1 pb-2 text-xs font-medium text-muted-foreground">
                {format.dateTime(leaf, { weekday: "long", timeZone: "UTC" })}
              </p>
            </div>
          </div>
          <div className="px-6 py-6 sm:px-8">
            {isGuest ? (
              <div className="flex h-full flex-col justify-between gap-4">
                <div>
                  <p className="eyebrow flex items-center gap-1.5">
                    <Clock3 className="size-3" />
                    {t("guestDailyQuizKicker")}
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.025em]">
                    {t("guestDailyQuizTitle")}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    {t("guestDailyQuizBlurb")}
                  </p>
                </div>
                <div>
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
          </div>
        </section>

        {/* Add notes on a torn-off legal pad. */}
        <Link
          href={`/classrooms/${classroom.id}/upload`}
          className="group relative block rotate-[0.8deg] transition-transform duration-300 hover:rotate-0 hover:-translate-y-1"
        >
          <div className="torn-top notepad flex h-full min-h-56 flex-col justify-between gap-4 rounded-b-2xl px-6 pt-8 pb-6 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.06),0_14px_30px_rgb(var(--shadow-colour)/0.08)]">
            <div>
              <PencilIcon className="size-6 text-primary transition-transform duration-300 group-hover:-rotate-12" />
              <h2 className="mt-4 font-heading text-2xl font-semibold tracking-[-0.025em]">
                {t("addNotesTitle")}
              </h2>
              <p className="mt-2 text-sm leading-7 text-foreground/75">{t("addNotesBlurb")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              {t("addNotes")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </div>

      <BankSummary counts={counts} manageHref={`/classrooms/${id}/bank`} />

      {/* Recent uploads as slips of paper taped to the page. */}
      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{t("pinboardKicker")}</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
              {t("recentUploads")}
            </h2>
          </div>
          <Link
            className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            href={`/classrooms/${classroom.id}/history`}
          >
            {t("viewHistory")}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            {t("noUploads")}
          </p>
        ) : (
          <ul className="mt-6 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map(({ upload }, index) => {
              const Icon = upload.kind === "text" ? FileText : ImageIcon;
              return (
                <li
                  key={upload.id}
                  className={cn(
                    "relative rounded-sm border border-border/70 bg-card px-5 pt-6 pb-4 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.05),0_8px_18px_rgb(var(--shadow-colour)/0.05)] transition-transform duration-200 hover:rotate-0",
                    index % 3 === 0 ? "-rotate-1" : index % 3 === 1 ? "rotate-[0.7deg]" : "-rotate-[0.4deg]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "tape absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2",
                      index % 2 === 0 ? "rotate-3" : "-rotate-2",
                    )}
                  />
                  <p className="line-clamp-2 min-h-12 text-sm leading-6 font-medium">
                    {upload.subject ??
                      (upload.kind === "text"
                        ? firstLine(upload.textContent, t("textNotes"))
                        : (upload.originalFilename ?? t("imageNotes")))}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-border pt-2.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="size-3.5" />
                      {upload.kind === "text" ? t("text") : t("image")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {upload.extractionStatus !== "done" ? (
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            upload.extractionStatus === "failed" ? "bg-destructive" : "animate-pulse bg-warning",
                          )}
                        />
                      ) : null}
                      {format.dateTime(upload.createdAt, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Recent quizzes in the logbook. */}
        <section className={cn("editorial-surface overflow-hidden rounded-[1.6rem]", unfinished.length === 0 && "lg:col-span-2")}>
          <div className="flex items-end justify-between gap-3 px-6 pt-6 pb-4 sm:px-8">
            <div>
              <p className="eyebrow">{t("logbookKicker")}</p>
              <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
                {t("recentQuizzes")}
              </h2>
            </div>
            <Link
              className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              href={`/classrooms/${classroom.id}/quizzes`}
            >
              {t("viewAll")}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          {recentQuizzes.length === 0 ? (
            <p className="logbook border-t border-border/70 py-6 pr-6 pl-[5.25rem] text-sm text-muted-foreground">
              {t("noQuizzes")}
            </p>
          ) : (
            <Logbook className="border-t border-border/70">
              {recentQuizzes.map((quiz) => (
                <LogbookRow
                  key={quiz.id}
                  href={`/classrooms/${classroom.id}/quiz/${quiz.id}`}
                  quizDate={quiz.quizDate}
                  title={
                    <>
                      {quiz.kind === "manual" ? t("onDemand") : t("daily")}
                      {quiz.kind === "manual" ? (
                        <Sparkles className="size-3.5 text-warning" aria-hidden="true" />
                      ) : null}
                    </>
                  }
                  meta={t("questions", { count: quiz.size })}
                  score={quiz.attemptCount === 0 ? null : (quiz.bestScore ?? 0)}
                  size={quiz.size}
                  pending={t("take")}
                />
              ))}
            </Logbook>
          )}
        </section>

        {/* Unfinished on-demand quizzes as a to-do checklist. */}
        {unfinished.length > 0 ? (
          <section className="notepad self-start rounded-2xl px-6 pt-6 pb-5 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.06),0_14px_30px_rgb(var(--shadow-colour)/0.07)]">
            <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]">{t("unfinished")}</h2>
            <p className="mt-1 text-sm leading-7 text-foreground/75">{t("unfinishedBlurb")}</p>
            <ul className="mt-2">
              {unfinished.map((quiz) => (
                <li key={quiz.id}>
                  <Link
                    href={`/classrooms/${classroom.id}/quiz/${quiz.id}`}
                    className="group flex items-center gap-3 py-1 leading-7"
                  >
                    <span className="grid size-4.5 shrink-0 place-items-center rounded-[4px] border-[1.5px] border-foreground/45 transition-colors group-hover:border-primary">
                      <Check className="size-3 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {formatQuizDate(quiz.quizDate, locale)}
                    </span>
                    <span className="text-xs text-foreground/60">
                      {t("questions", { count: quiz.size })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

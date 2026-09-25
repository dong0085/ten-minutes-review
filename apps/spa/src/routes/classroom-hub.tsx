import { Link, useParams, useSearchParams } from "react-router";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Globe2,
  Library,
  Moon,
  NotebookPen,
  PauseCircle,
  Settings2,
} from "lucide-react";
import { classroomDailyStatus } from "@tmr/core";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { cn } from "@tmr/ui/utils";
import { STATUS_STAMP } from "@/components/classroom/classroom-card";
import { TodayQuizAction } from "@/components/classroom/today-quiz-action";
import { GuestBanner } from "@/components/guest-banner";
import { DrillList, SectionTitle } from "@/components/page";
import { PencilIcon } from "@/components/pencil-icon";
import { FullPageSpinner } from "@/app/shell";
import { formatQuizDate } from "@/lib/format";
import { languageLabel } from "@/lib/language-label";
import { useClassroom, useOverview } from "@/lib/queries";
import { formatResetTime } from "@/lib/send-time";
import { useSession } from "@/lib/session";
import { ErrorPanel } from "./errors";

/**
 * The classroom's front page. It answers one question — what do I do today? —
 * and lists the deeper screens (notes, bank, quizzes, settings) as rows.
 */
export function ClassroomHubPage() {
  const { id } = useParams() as { id: string };
  const [searchParams] = useSearchParams();
  const t = useTranslations("Classroom.HomePage");
  const tLayout = useTranslations("Classroom.Layout");
  const tHub = useTranslations("App.Hub");
  const locale = useLocale();
  const format = useFormatter();
  const { data: session } = useSession();
  const { data: classroom } = useClassroom(id);
  const { data: overview, dataUpdatedAt, error, isPending, refetch } = useOverview(id);

  if (isPending || !classroom || !session) {
    return <FullPageSpinner />;
  }
  if (error || !overview) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }

  const isGuest = session.isGuest;
  const status = classroomDailyStatus({
    activeUntil: new Date(classroom.activeUntil),
    pausedAt: classroom.pausedAt ? new Date(classroom.pausedAt) : null,
  });
  const reset = formatResetTime(locale, session.user.timezone);
  const leaf = new Date(`${overview.today}T00:00:00Z`);
  const base = `/classrooms/${id}`;
  const { counts } = overview;

  return (
    <div className="space-y-10">
      {isGuest ? <GuestBanner /> : null}

      <header className="space-y-4">
        <h1 className="font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          <span className="marker-swipe">{classroom.name}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
            <Globe2 className="size-3.5 text-primary" />
            {languageLabel(classroom.targetLanguage, locale)} <span aria-hidden="true">→</span>{" "}
            {languageLabel(classroom.nativeLanguage, locale)}
          </span>
          <span
            className={cn(
              "ink-stamp rounded-md px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.16em] uppercase",
              STATUS_STAMP[status],
            )}
          >
            {status === "paused"
              ? tLayout("pausedStatus")
              : status === "dormant"
                ? tLayout("dormantStatus")
                : tLayout("activeStatus")}
          </span>
        </div>
        {status !== "active" ? (
          <p className="flex max-w-xl items-start gap-2.5 rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm leading-6">
            {status === "paused" ? (
              <PauseCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <Moon className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            {status === "paused" ? tLayout("paused") : tLayout("dormant")}
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* Today's quiz on a tear-off desk calendar. */}
        <section className="editorial-surface grid overflow-hidden rounded-[1.6rem] sm:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="relative hidden items-center justify-center border-r border-border/70 bg-muted/40 px-5 py-7 sm:flex">
            <div className="relative w-24 rotate-[-2deg] rounded-xl bg-card text-center shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.06),0_12px_24px_rgb(var(--shadow-colour)/0.1)] transition-transform duration-300 hover:rotate-0">
              <span aria-hidden="true" className="absolute -top-2 left-0 flex w-full justify-around px-4">
                <span className="h-4 w-1.5 rounded-full border border-foreground/25 bg-background" />
                <span className="h-4 w-1.5 rounded-full border border-foreground/25 bg-background" />
              </span>
              <p className="rounded-t-xl bg-primary py-1.5 text-[0.68rem] font-bold tracking-[0.18em] text-primary-foreground uppercase">
                {format.dateTime(leaf, { month: "short", timeZone: "UTC" })}
              </p>
              <p className="pt-1 font-heading text-4xl leading-tight font-semibold tabular-nums">
                {format.dateTime(leaf, { day: "numeric", timeZone: "UTC" })}
              </p>
              <p className="border-t border-dashed border-border pt-1 pb-2 text-xs font-medium text-muted-foreground">
                {format.dateTime(leaf, { weekday: "short", timeZone: "UTC" })}
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
                    <a href="/signup">
                      {t("guestDailyQuizCta")}
                      <ArrowRight />
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <TodayQuizAction
                classroomId={id}
                dailyQuizId={overview.dailyQuizId}
                bankSize={counts.bank}
                paused={classroom.pausedAt !== null}
                nowMs={dataUpdatedAt}
                autoStart={searchParams.get("create") === "1"}
                resetLocal={reset.local}
                resetUtc={reset.utc}
                resetTomorrow={reset.tomorrow}
                initialJob={overview.composeJob}
              />
            )}
          </div>
        </section>

        {/* Add notes on a torn-off legal pad. */}
        <Link
          to={`${base}/notes/new`}
          className="group relative block rotate-[0.8deg] transition-transform duration-300 hover:-translate-y-1 hover:rotate-0"
        >
          <div className="torn-top notepad flex h-full min-h-48 flex-col justify-between gap-4 rounded-b-2xl px-6 pt-8 pb-6 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.06),0_14px_30px_rgb(var(--shadow-colour)/0.08)]">
            <div>
              <PencilIcon className="size-6 text-primary transition-transform duration-300 group-hover:-rotate-12" />
              <h2 className="mt-4 font-heading text-2xl font-semibold tracking-[-0.025em]">
                {t("addNotesTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-foreground/75">{tHub("addNotesBlurb")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              {t("addNotes")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </div>

      {overview.unfinished.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>{t("unfinished")}</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {overview.unfinished.map((quiz) => (
              <li key={quiz.id}>
                <Link
                  to={`${base}/quizzes/${quiz.id}/take`}
                  className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 py-1.5 pr-3.5 pl-2 text-sm transition hover:border-primary/40"
                >
                  <span className="grid size-4.5 place-items-center rounded-[4px] border-[1.5px] border-foreground/45 transition-colors group-hover:border-primary">
                    <Check className="size-3 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="font-medium">{formatQuizDate(quiz.quizDate, locale)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("questions", { count: quiz.size })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>{tHub("inside")}</SectionTitle>
        <DrillList
          items={[
            {
              to: `${base}/notes`,
              icon: NotebookPen,
              title: tHub("notes"),
              meta:
                counts.uploads === 0
                  ? t("noUploads")
                  : overview.lastUploadAt
                    ? tHub("notesMeta", {
                        count: counts.uploads,
                        when: format.relativeTime(new Date(overview.lastUploadAt)),
                      })
                    : null,
              badge:
                counts.pendingUploads > 0 ? (
                  <Badge variant="warning">{tHub("reading", { count: counts.pendingUploads })}</Badge>
                ) : null,
            },
            {
              to: `${base}/bank`,
              icon: Library,
              title: tHub("bank"),
              meta: tHub("bankMeta", { count: counts.bank }),
            },
            {
              to: `${base}/quizzes`,
              icon: BookOpen,
              title: tHub("quizzes"),
              meta:
                counts.quizzes === 0
                  ? t("noQuizzes")
                  : tHub("quizzesMeta", { count: counts.quizzes }),
            },
            {
              to: `${base}/settings`,
              icon: Settings2,
              title: tHub("settings"),
              meta: tHub("settingsMeta"),
            },
          ]}
        />
      </section>
    </div>
  );
}

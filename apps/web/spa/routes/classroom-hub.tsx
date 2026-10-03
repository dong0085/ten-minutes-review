import { Link, useParams, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import {
  ArrowRight,
  Globe2,
  Library,
  Moon,
  NotebookPen,
  NotebookText,
  PauseCircle,
  Settings2,
} from "lucide-react";
import {
  classroomDailyStatus,
  isQuizLength,
  QUIZ_LENGTH_MINUTES,
} from "@tmr/core";
import { Badge } from "@tmr/ui/components/badge";
import { CtaIcon } from "@tmr/ui/components/cta-icon";
import { cn } from "@tmr/ui/utils";
import { STATUS_STAMP } from "@/spa/components/classroom/classroom-card";
import { QuizzesSection } from "@/spa/components/classroom/quizzes-section";
import { TodayQuizCard } from "@/spa/components/classroom/today-quiz-card";
import { useQuizJob } from "@/spa/components/classroom/use-quiz-job";
import { GuestBanner } from "@/spa/components/guest-banner";
import { DrillList, SectionTitle } from "@/spa/components/page";
import { FullPageSpinner } from "@/spa/app/shell";
import { languageLabel } from "@/spa/lib/language-label";
import {
  useClassroom,
  useOverview,
  type Classroom,
  type ClassroomOverview,
} from "@/spa/lib/queries";
import { formatResetTime } from "@/spa/lib/send-time";
import { useSession, type Session } from "@/spa/lib/session";
import { PEEK_SPRING, usePeek } from "@/spa/lib/use-peek";
import { ErrorPanel } from "./errors";

/**
 * The classroom's front page, built around why people open it: today's quiz
 * (the mailbox), adding notes (the notepad), and every quiz and exam in one
 * section. The deeper screens (notes, bank, corrections, settings) follow as
 * rows.
 */
export function ClassroomHubPage() {
  const { id } = useParams() as { id: string };
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  const { data: classroom } = useClassroom(id);
  const {
    data: overview,
    error,
    isPending,
    refetch,
  } = useOverview(id);

  if (isPending || !classroom || !session) {
    return <FullPageSpinner />;
  }
  if (error || !overview) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  return (
    <ClassroomHub
      id={id}
      classroom={classroom}
      session={session}
      overview={overview}
      autoStart={searchParams.get("create") === "1"}
    />
  );
}

/** The hub once its data has loaded, so the quiz job can start from the overview. */
function ClassroomHub({
  id,
  classroom,
  session,
  overview,
  autoStart,
}: {
  id: string;
  classroom: Classroom;
  session: Session;
  overview: ClassroomOverview;
  autoStart: boolean;
}) {
  const t = useTranslations("Classroom.HomePage");
  const tLayout = useTranslations("Classroom.Layout");
  const tHub = useTranslations("App.Hub");
  const tExam = useTranslations("Classroom.ExamCard");
  const locale = useLocale();
  const format = useFormatter();
  const padPeek = usePeek();
  const quizJob = useQuizJob(id, overview.composeJob);

  const isGuest = session.isGuest;
  const status = classroomDailyStatus({
    activeUntil: new Date(classroom.activeUntil),
    pausedAt: classroom.pausedAt ? new Date(classroom.pausedAt) : null,
  });
  const reset = formatResetTime(locale, session.user.timezone);
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
            {languageLabel(classroom.targetLanguage, locale)}{" "}
            <span aria-hidden="true">→</span>{" "}
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
        <TodayQuizCard
          classroomId={id}
          today={overview.today}
          dailyQuizId={overview.dailyQuizId}
          dailyReview={overview.dailyReview}
          bankSize={counts.bank}
          pendingUploads={counts.pendingUploads}
          minutes={
            QUIZ_LENGTH_MINUTES[
              isQuizLength(classroom.quizLength) ? classroom.quizLength : 0
            ]
          }
          paused={classroom.pausedAt !== null}
          isGuest={isGuest}
          resetLocal={reset.local}
          resetUtc={reset.utc}
          resetTomorrow={reset.tomorrow}
        />

        {/* Add notes on a torn-off legal pad, taped to the desk. */}
        <motion.div
          {...padPeek}
          variants={{ rest: { y: 0, rotate: 0.8 }, open: { y: -5, rotate: 0 } }}
          transition={PEEK_SPRING}
        >
          <Link to={`${base}/notes/new`} className="relative block h-full">
            <div className="torn-top notepad flex h-full min-h-48 flex-col justify-between gap-4 rounded-b-2xl px-6 pt-8 pb-6 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.1),0_4px_10px_rgb(var(--shadow-colour)/0.08),0_18px_36px_rgb(var(--shadow-colour)/0.14)]">
              <div>
                <motion.span
                  className="inline-block"
                  variants={{
                    rest: { rotate: 0, x: 0, y: 0 },
                    open: { rotate: [0, -18, -8, -14], x: 2, y: -2 },
                  }}
                  transition={{
                    rotate: { duration: 0.6, ease: "easeInOut" },
                    default: PEEK_SPRING,
                  }}
                >
                  <CtaIcon kind="notes" className="size-7 text-foreground" />
                </motion.span>
                <h2 className="mt-4 font-heading text-2xl font-semibold tracking-[-0.025em]">
                  {t("addNotesTitle")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-foreground/75">
                  {tHub("addNotesBlurb")}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {t("addNotes")}
                <motion.span
                  className="inline-flex"
                  variants={{ rest: { x: 0 }, open: { x: 4 } }}
                  transition={PEEK_SPRING}
                >
                  <ArrowRight className="size-4" />
                </motion.span>
              </span>
            </div>
            <span
              aria-hidden="true"
              className="tape absolute -top-2 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-3 rounded-[2px]"
            />
          </Link>
        </motion.div>
      </div>

      <QuizzesSection
        classroomId={id}
        quizzes={overview.recentQuizzes}
        totalQuizzes={counts.quizzes}
        bankSize={counts.bank}
        exam={overview.exam}
        isGuest={isGuest}
        isPaid={session.plan.isPaid}
        billingEnabled={session.features.billing}
        autoStart={autoStart}
        job={quizJob}
      />

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
                        when: format.relativeTime(
                          new Date(overview.lastUploadAt),
                        ),
                      })
                    : null,
              badge:
                counts.pendingUploads > 0 ? (
                  <Badge variant="warning">
                    {tHub("reading", { count: counts.pendingUploads })}
                  </Badge>
                ) : null,
            },
            {
              to: `${base}/bank`,
              icon: Library,
              title: tHub("bank"),
              meta: tHub("bankMeta", { count: counts.bank }),
            },
            ...(isGuest
              ? []
              : [
                  {
                    to: `${base}/mistakes`,
                    icon: NotebookText,
                    title: tHub("mistakes"),
                    meta: session.plan.isPaid
                      ? tHub("mistakesMeta", { count: overview.mistakes })
                      : null,
                    badge: !session.plan.isPaid ? (
                      <Badge>{tExam("proBadge")}</Badge>
                    ) : overview.mistakes > 0 ? (
                      <Badge variant="destructive">{overview.mistakes}</Badge>
                    ) : null,
                  },
                ]),
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

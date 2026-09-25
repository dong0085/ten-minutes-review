import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@tmr/ui/components/tooltip";
import { ClassroomCard } from "@/components/classroom/classroom-card";
import { NewClassroomButton } from "@/components/classroom/new-classroom-button";
import { GuestBanner } from "@/components/guest-banner";
import { PageHeader } from "@/components/page";
import { FullPageSpinner } from "@/app/shell";
import { useClassrooms } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { ErrorPanel } from "./errors";

function EmptyState() {
  const t = useTranslations("Classroom.ListPage");
  return (
    <div className="mx-auto max-w-3xl py-6 sm:py-12">
      <div className="editorial-surface relative overflow-hidden rounded-[2rem] px-6 py-12 text-center sm:px-12 sm:py-16">
        <div aria-hidden="true" className="absolute inset-x-16 top-0 h-px bg-primary/30" />
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.09] text-primary">
          <BookOpen className="size-5" />
        </span>
        <p className="eyebrow mt-7">{t("emptyKicker")}</p>
        <h1 className="mx-auto mt-3 max-w-xl font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {t("emptyTitle")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
          {t("emptyBlurb")}
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/classrooms/new">
            {t("create")}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function ClassroomListPage() {
  const t = useTranslations("Classroom.ListPage");
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useClassrooms(Boolean(session));

  if (!session) {
    return <EmptyState />;
  }
  if (isPending) {
    return <FullPageSpinner />;
  }
  if (error || !data) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  const { classrooms, limits } = data;
  if (classrooms.length === 0) {
    return <EmptyState />;
  }
  const activeCount = classrooms.filter((classroom) => classroom.status === "active").length;
  const isPaid = session.plan.isPaid;

  return (
    <div className="space-y-10">
      {session.isGuest ? <GuestBanner /> : null}
      <PageHeader
        kicker={t("kicker")}
        title={<span className="marker-swipe">{t("title")}</span>}
        description={t("blurb")}
        actions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  className="hidden cursor-help items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3.5 py-2 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  {isPaid
                    ? t("activeCount", { active: activeCount })
                    : t("activeSummary", { active: activeCount, total: classrooms.length })}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="space-y-1.5 py-2 leading-5">
                <p>{t("activeHint")}</p>
                {limits ? (
                  <p className="text-muted-foreground">
                    {t("uploadsHint", {
                      used: Math.min(limits.uploadsThisMonth, limits.uploadsPerMonth),
                      limit: limits.uploadsPerMonth,
                    })}
                  </p>
                ) : null}
              </TooltipContent>
            </Tooltip>
            <NewClassroomButton
              locked={limits !== null && classrooms.length >= limits.classrooms}
              billingEnabled={session.features.billing}
            />
          </>
        }
      />
      <div className="grid gap-x-6 gap-y-8 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {classrooms.map((classroom, index) => (
          <ClassroomCard
            key={classroom.id}
            index={index + 1}
            classroom={classroom}
            bankSize={classroom.bankSize}
            todayQuizId={classroom.todayQuizId}
            status={classroom.status}
            daysRemaining={classroom.quizDaysRemaining}
          />
        ))}
      </div>
    </div>
  );
}

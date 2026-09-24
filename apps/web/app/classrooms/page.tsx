import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, Plus, Sparkles } from "lucide-react";
import {
  FREE_TIER,
  classroomDailyStatus,
  classroomQuizDaysRemaining,
  startOfMonthAt,
} from "@tmr/core";
import {
  bankSize,
  countUploadsSince,
  getDailyQuizByClassroomAndDate,
  hasPaidPlan,
  listClassrooms,
} from "@tmr/db";
import { ClassroomCard } from "@/components/classroom/classroom-card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false },
};

function localDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default async function ClassroomsPage() {
  const current = await getCurrentUserOrGuest();
  const t = await getTranslations("Classroom.ListPage");
  const tHome = await getTranslations("Classroom.HomePage");

  if (!current) {
    return (
      <div className="mx-auto max-w-3xl py-10 sm:py-16">
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
            <Link href="/classrooms/new">
              {t("create")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { user, isGuest } = current;
  const db = getDb();
  const classrooms = await listClassrooms(db, user.id);
  const today = localDate(user.timezone);

  const cards = await Promise.all(
    classrooms.map(async (classroom) => {
      const [size, quiz] = await Promise.all([
        bankSize(db, classroom.id),
        getDailyQuizByClassroomAndDate(db, classroom.id, today),
      ]);
      return {
        classroom,
        bankSize: size,
        todayQuizId: quiz?.id ?? null,
        status: classroomDailyStatus(classroom),
        quizDaysRemaining: classroomQuizDaysRemaining(classroom, user.timezone),
      };
    }),
  );

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-10 sm:py-16">
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
            <Link href="/classrooms/new">
              {t("create")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const activeCount = cards.filter(({ status }) => status === "active").length;
  const isPaid = !isGuest && (await hasPaidPlan(db, user.id));
  const uploadsThisMonth =
    isPaid || isGuest ? null : await countUploadsSince(db, user.id, startOfMonthAt(user.timezone));

  return (
    <div className="space-y-8">
      {isGuest ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:px-5">
          <p className="text-sm font-medium text-foreground/90">{tHome("guestBanner")}</p>
          <Button asChild size="sm">
            <Link href="/signup">
              {tHome("guestBannerAction")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 border-b border-border/70 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{t("kicker")}</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("blurb")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                tabIndex={0}
                className="hidden cursor-help items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3.5 py-2 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex"
              >
                <Sparkles className="size-3.5 text-primary" />
                {isPaid
                  ? t("activeCount", { active: activeCount })
                  : t("activeSummary", { active: activeCount, total: cards.length })}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="space-y-1.5 py-2 leading-5">
              <p>{t("activeHint")}</p>
              {uploadsThisMonth !== null ? (
                <p className="text-muted-foreground">
                  {t("uploadsHint", {
                    used: Math.min(uploadsThisMonth, FREE_TIER.notesUploadsPerMonth),
                    limit: FREE_TIER.notesUploadsPerMonth,
                  })}
                </p>
              ) : null}
            </TooltipContent>
          </Tooltip>
          <Button asChild>
            <Link href="/classrooms/new">
              <Plus />
              {t("newClassroom")}
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ classroom, bankSize: size, todayQuizId, status, quizDaysRemaining }, index) => (
          <ClassroomCard
            key={classroom.id}
            index={index + 1}
            classroom={classroom}
            bankSize={size}
            todayQuizId={todayQuizId}
            status={status}
            daysRemaining={quizDaysRemaining}
          />
        ))}
      </div>
    </div>
  );
}

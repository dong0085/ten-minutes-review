import { Link } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ArrowUpRight, FilePlus2 } from "lucide-react";
import type { ClassroomDailyStatus } from "@tmr/core";
import type { ClassroomSummary } from "@/lib/queries";
import { Button } from "@tmr/ui/components/button";
import { PencilIcon } from "@/components/pencil-icon";
import { languageLabel } from "@/lib/language-label";
import { cn } from "@tmr/ui/utils";

// Spine colours cycle so a shelf of notebooks reads as a set.
const SPINES = [
  "var(--primary)",
  "color-mix(in oklch, var(--warning), var(--card) 15%)",
  "var(--success)",
  "color-mix(in oklch, var(--destructive), var(--card) 25%)",
  "var(--chart-3)",
];

export const STATUS_STAMP: Record<ClassroomDailyStatus, string> = {
  active: "text-success",
  paused: "text-destructive",
  dormant: "text-warning",
};

// A classroom drawn as a school exercise book: cloth spine, a label plate
// with the name, an ink status stamp, and a ribbon when today's quiz is in.
export function ClassroomCard({
  classroom,
  index,
  bankSize,
  todayQuizId,
  status,
  daysRemaining,
}: {
  classroom: ClassroomSummary;
  index: number;
  bankSize: number;
  todayQuizId: string | null;
  status: ClassroomDailyStatus;
  daysRemaining: number;
}) {
  const t = useTranslations("Classroom.Card");
  const locale = useLocale();
  const target = languageLabel(classroom.targetLanguage, locale);
  const native = languageLabel(classroom.nativeLanguage, locale);

  return (
    <article
      style={{ "--spine": SPINES[(index - 1) % SPINES.length] } as React.CSSProperties}
      className="exercise-book group relative flex min-h-72 flex-col gap-5 rounded-l-md rounded-r-2xl border border-border/80 bg-card py-5 pr-5 pl-9 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.05),0_12px_32px_rgb(var(--shadow-colour)/0.05)] transition duration-200 hover:-translate-y-1 hover:-rotate-[0.4deg] hover:shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.05),0_24px_50px_rgb(var(--shadow-colour)/0.1)]"
    >
      {todayQuizId ? (
        <span
          className="ribbon absolute -top-1 right-6 grid h-14 w-7 place-items-start justify-center bg-destructive/85 pt-2 text-[0.55rem] font-bold text-white shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.15)] transition-[height] duration-300 group-hover:h-16"
          title={t("takeToday")}
        >
          <span className="sr-only">{t("takeToday")}</span>
          <span aria-hidden="true">★</span>
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-3 pr-8">
        <span className="font-mono text-[0.68rem] tracking-[0.18em] text-muted-foreground uppercase">
          {t("number", { index: String(index).padStart(2, "0") })}
        </span>
      </div>

      <Link
        to={`/classrooms/${classroom.id}`}
        className="label-plate block px-4 py-3 transition-colors hover:bg-accent/40"
      >
        <span className="block font-heading text-xl leading-7 font-semibold tracking-[-0.018em]">
          {classroom.name}
        </span>
        <span className="mt-1 block border-t border-dashed border-border pt-1.5 text-xs text-muted-foreground">
          {target} <span aria-hidden="true">→</span> {native}
        </span>
      </Link>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-heading text-3xl font-semibold tabular-nums">{bankSize}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("knowledgePoints", { count: bankSize })}
          </p>
        </div>
        <span
          className={cn(
            "ink-stamp shrink-0 rounded-md px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.16em] uppercase",
            STATUS_STAMP[status],
          )}
        >
          {t(status)}
        </span>
      </div>

      <div className="mt-auto space-y-3">
        {todayQuizId ? (
          <Button asChild className="w-full justify-between">
            <Link to={`/classrooms/${classroom.id}/quizzes/${todayQuizId}/take`}>
              {t("takeToday")}
              <ArrowUpRight />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full justify-between">
            <Link to={`/classrooms/${classroom.id}/notes/new`}>
              {t("addNotes")}
              <FilePlus2 />
            </Link>
          </Button>
        )}
        {status !== "dormant" ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <PencilIcon className="size-3.5 shrink-0" />
            {t("daysRemaining", { count: daysRemaining })}
          </p>
        ) : null}
      </div>
    </article>
  );
}

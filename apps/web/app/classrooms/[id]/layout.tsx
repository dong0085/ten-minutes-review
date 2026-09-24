import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Globe2, Moon, PauseCircle } from "lucide-react";
import { classroomDailyStatus } from "@tmr/core";
import { getClassroom } from "@tmr/db";
import { STATUS_STAMP } from "@/components/classroom/classroom-card";
import { ClassroomTabs } from "@/components/classroom/classroom-tabs";
import { getDb } from "@/lib/db";
import { languageLabel } from "@/lib/language-label";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function ClassroomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser({ allowGuest: true });
  const t = await getTranslations("Classroom.Layout");
  const locale = await getLocale();
  const classroom = await getClassroom(getDb(), user.id, id);
  if (!classroom) {
    notFound();
  }
  const status = classroomDailyStatus(classroom);
  const target = languageLabel(classroom.targetLanguage, locale);
  const native = languageLabel(classroom.nativeLanguage, locale);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/classrooms"
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            {t("back")}
          </Link>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            <span className="marker-swipe">{classroom.name}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
            <Globe2 className="size-3.5 text-primary" />
            {target} <span aria-hidden="true">→</span> {native}
          </span>
          <span
            className={cn(
              "ink-stamp rounded-md px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.16em] uppercase",
              STATUS_STAMP[status],
            )}
          >
            {status === "paused"
              ? t("pausedStatus")
              : status === "dormant"
                ? t("dormantStatus")
                : t("activeStatus")}
          </span>
        </div>
      </div>
      {status !== "active" ? (
        // A sticky note pinned under the title while reviews are off.
        <div className="relative max-w-xl -rotate-[0.6deg] rounded-sm px-5 pt-5 pb-4 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.06),0_10px_24px_rgb(var(--shadow-colour)/0.06)] notepad">
          <span
            aria-hidden="true"
            className="tape absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-2"
          />
          <p className="flex items-start gap-2.5 text-sm leading-6">
            {status === "paused" ? (
              <PauseCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <Moon className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            {status === "paused" ? t("paused") : t("dormant")}
          </p>
        </div>
      ) : null}
      <ClassroomTabs classroomId={classroom.id} />
      {children}
    </div>
  );
}

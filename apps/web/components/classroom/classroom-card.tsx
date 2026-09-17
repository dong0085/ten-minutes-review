import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, BookOpenText, FilePlus2 } from "lucide-react";
import type { ClassroomDailyStatus } from "@tmr/core";
import type { Classroom } from "@tmr/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PencilIcon } from "@/components/pencil-icon";
import { languageLabel } from "@/lib/language-label";

export async function ClassroomCard({
  classroom,
  index,
  bankSize,
  todayQuizId,
  status,
  daysRemaining,
}: {
  classroom: Classroom;
  index: number;
  bankSize: number;
  todayQuizId: string | null;
  status: ClassroomDailyStatus;
  daysRemaining: number;
}) {
  const t = await getTranslations("Classroom.Card");
  const locale = await getLocale();
  const target = languageLabel(classroom.targetLanguage, locale);
  const native = languageLabel(classroom.nativeLanguage, locale);

  return (
    <Card className="group relative min-h-64 transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.04),0_22px_55px_rgb(var(--shadow-colour)/0.08)]">
      <div
        aria-hidden="true"
        className="absolute inset-x-5 top-0 h-px bg-primary/25 opacity-0 transition-opacity group-hover:opacity-100"
      />
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-primary/10 bg-primary/[0.07] text-primary">
            <BookOpenText className="size-4.5" />
          </span>
          <span className="font-heading text-xs italic text-muted-foreground/55">
            {String(index).padStart(2, "0")}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href={`/classrooms/${classroom.id}`}
              className="font-heading text-xl font-semibold tracking-[-0.018em] underline-offset-4 hover:underline"
            >
              {classroom.name}
            </Link>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {target} <span aria-hidden="true">→</span> {native}
            </p>
          </div>
          <Badge
            variant={status === "active" ? "success" : status === "paused" ? "destructive" : "warning"}
            className="gap-1.5"
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {t(status)}
          </Badge>
        </div>
        <div className="mt-auto border-t border-border/65 pt-4">
          <p className="font-heading text-2xl font-semibold tabular-nums">{bankSize}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("knowledgePoints", { count: bankSize })}
          </p>
        </div>
        <div>
          {todayQuizId ? (
            <Button asChild className="w-full justify-between">
              <Link href={`/classrooms/${classroom.id}/quiz/${todayQuizId}`}>
                {t("takeToday")}
                <ArrowUpRight />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href={`/classrooms/${classroom.id}/upload`}>
                {t("addNotes")}
                <FilePlus2 />
              </Link>
            </Button>
          )}
        </div>
        {status !== "dormant" ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PencilIcon className="size-3.5 shrink-0" />
            <span>{t("daysRemaining", { count: daysRemaining })}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Globe2 } from "lucide-react";
import { getClassroom } from "@tmr/db";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { isClassroomDormant } from "@/components/classroom/classroom-card";
import { ClassroomTabs } from "@/components/classroom/classroom-tabs";
import { getDb } from "@/lib/db";
import { languageLabel } from "@/lib/language-label";
import { requireUser } from "@/lib/session";

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
  const dormant = isClassroomDormant(classroom.activeUntil);
  const target = languageLabel(classroom.targetLanguage, locale);
  const native = languageLabel(classroom.nativeLanguage, locale);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/classrooms"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("back")}
          </Link>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {classroom.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
            <Globe2 className="size-3.5 text-primary" />
            {target} <span aria-hidden="true">→</span> {native}
          </span>
          <Badge variant={dormant ? "warning" : "success"} className="gap-1.5">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {dormant ? t("dormantStatus") : t("activeStatus")}
          </Badge>
        </div>
      </div>
      {dormant ? (
        <Alert className="border-warning/20 bg-warning/[0.06]">
          <AlertDescription>{t("dormant")}</AlertDescription>
        </Alert>
      ) : null}
      <ClassroomTabs classroomId={classroom.id} />
      {children}
    </div>
  );
}

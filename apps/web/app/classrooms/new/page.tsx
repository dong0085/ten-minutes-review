import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FREE_TIER, isLanguageCode } from "@tmr/core";
import { countClassrooms, hasPaidPlan } from "@tmr/db";
import { NewClassroomForm } from "@/components/classroom/new-classroom-form";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function NewClassroomPage() {
  const current = await getCurrentUserOrGuest();
  if (current && !current.isGuest) {
    const db = getDb();
    if (
      (await countClassrooms(db, current.user.id)) >= FREE_TIER.classrooms &&
      !(await hasPaidPlan(db, current.user.id))
    ) {
      // The classrooms list shows the locked button and upgrade prompt.
      redirect("/classrooms");
    }
  }
  const t = await getTranslations("Classroom.NewForm");
  const defaultNativeLanguage =
    current && isLanguageCode(current.user.uiLanguage) ? current.user.uiLanguage : "en";

  return (
    <div className="mx-auto max-w-lg space-y-7 py-4">
      <div className="text-center">
        <div className="mx-auto h-px w-10 bg-primary/40" />
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("pageTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {t("pageBlurb")}
        </p>
      </div>
      <NewClassroomForm defaultNativeLanguage={defaultNativeLanguage} />
    </div>
  );
}

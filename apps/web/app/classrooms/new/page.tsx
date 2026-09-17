import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isLanguageCode } from "@tmr/core";
import { NewClassroomForm } from "@/components/classroom/new-classroom-form";
import { getCurrentUserOrGuest } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function NewClassroomPage() {
  const current = await getCurrentUserOrGuest();
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

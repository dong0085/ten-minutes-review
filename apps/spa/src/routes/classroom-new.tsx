import { Navigate } from "react-router";
import { useTranslations } from "use-intl";
import { isLanguageCode } from "@tmr/core";
import { NewClassroomForm } from "@/components/classroom/new-classroom-form";
import { FullPageSpinner } from "@/app/shell";
import { useClassrooms } from "@/lib/queries";
import { useSession } from "@/lib/session";

export function NewClassroomPage() {
  const t = useTranslations("Classroom.NewForm");
  const { data: session } = useSession();
  const signedIn = Boolean(session && !session.isGuest);
  const { data, isPending } = useClassrooms(signedIn);

  if (signedIn && isPending) {
    return <FullPageSpinner />;
  }
  // At the free-plan cap, the list shows the locked button and upgrade prompt.
  if (data?.limits && data.classrooms.length >= data.limits.classrooms) {
    return <Navigate to="/classrooms" replace />;
  }
  const uiLanguage = session?.user.uiLanguage;
  const defaultNativeLanguage = uiLanguage && isLanguageCode(uiLanguage) ? uiLanguage : "en";

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

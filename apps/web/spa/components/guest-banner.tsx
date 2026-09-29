import { useTranslations } from "use-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@tmr/ui/components/button";

export function GuestBanner() {
  const t = useTranslations("Classroom.HomePage");
  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:px-5">
      <p className="text-sm font-medium text-foreground/90">{t("guestBanner")}</p>
      <Button asChild size="sm">
        <a href="/signup">
          {t("guestBannerAction")}
          <ArrowRight className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

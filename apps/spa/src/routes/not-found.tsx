import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@tmr/ui/components/button";

export function NotFoundPage() {
  const t = useTranslations("NotFound");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center py-8 sm:py-14">
      <div className="editorial-surface paper-lines relative w-full -rotate-[0.6deg] rounded-xl px-6 py-10 sm:px-10 sm:py-12">
        <span className="absolute -top-3 right-6 rotate-[4deg] rounded-md border-2 border-dashed border-destructive/50 bg-card px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.18em] text-destructive uppercase">
          {t("stamp")}
        </span>
        <p className="eyebrow">{t("eyebrow")}</p>
        <span className="marker-loop marker-loop-lg mt-4 inline-block font-heading text-[5.5rem] leading-none font-semibold tracking-[-0.04em] sm:text-[7rem]">
          404
        </span>
        <p className="mt-7 font-heading text-xl leading-relaxed text-muted-foreground italic sm:text-[1.35rem]">
          {t("comment")}
        </p>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/classrooms">{t("goToClassrooms")}</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="/">{t("backHome")}</a>
        </Button>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, X } from "lucide-react";
import { Button } from "@tmr/ui/components/button";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center py-8 sm:py-14">
      <div
        data-reveal="shown"
        className="editorial-surface paper-lines relative w-full -rotate-[0.6deg] rounded-xl px-6 py-10 sm:px-10 sm:py-12"
      >
        <span className="absolute -top-3 right-6 rotate-[4deg] rounded-md border-2 border-dashed border-destructive/50 bg-card px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.18em] text-destructive uppercase">
          {t("stamp")}
        </span>
        <p className="eyebrow">{t("eyebrow")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="marker-loop marker-loop-lg font-heading text-[5.5rem] leading-none font-semibold tracking-[-0.04em] sm:text-[7rem]">
            404
          </span>
          <span className="font-heading text-lg text-destructive italic">
            {t("score")}
          </span>
        </div>
        <p className="font-heading mt-7 text-xl leading-relaxed text-muted-foreground italic sm:text-[1.35rem]">
          {t("comment")}
        </p>
        <div className="mt-8 border-t border-border/70 pt-5 text-sm">
          <p className="text-muted-foreground">{t("correctionsTitle")}</p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center gap-2.5">
              <X aria-hidden="true" className="size-4 text-destructive" />
              <span>{t("correctionsMissing")}</span>
              <span className="text-muted-foreground">
                — {t("correctionsMissingMark")}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check aria-hidden="true" className="size-4 text-success" />
              <span>{t("correctionsPresent")}</span>
              <span className="text-muted-foreground">
                — {t("correctionsPresentMark")}
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">{t("backHome")}</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="/classrooms">{t("goToClassrooms")}</a>
        </Button>
      </div>
    </div>
  );
}

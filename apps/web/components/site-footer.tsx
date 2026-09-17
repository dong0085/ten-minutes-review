import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="mt-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border/70 py-6 text-sm text-muted-foreground sm:mt-20">
      <p>{t("copyright")}</p>
      <nav aria-label={t("navLabel")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link className="hover:text-foreground" href="/about">
          {t("about")}
        </Link>
        <Link className="hover:text-foreground" href="/privacy">
          {t("privacy")}
        </Link>
        <a
          className="inline-flex items-center gap-1 hover:text-foreground"
          href="https://ericinottawa.ca"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("builtBy")}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </nav>
    </footer>
  );
}

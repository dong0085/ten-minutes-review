import { getTranslations } from "next-intl/server";
import { Archive, Check, Download } from "lucide-react";
import { AccountHeader } from "@/components/account/account-header";
import { DeleteAccount } from "@/components/account/delete-account";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

const PACKING_LIST = [
  "profile",
  "classrooms",
  "notes",
  "questions",
  "quizzes",
  "attempts",
  "emails",
  "billing",
] as const;

export default async function AccountDataPage() {
  await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");

  return (
    <div className="space-y-10">
      <AccountHeader kicker={t("title")} title={tNav("data")} description={t("Pages.data")} />

      {/* Export: an archive box with its packing list. */}
      <section className="editorial-surface grid overflow-hidden rounded-[1.6rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="px-6 py-7 sm:px-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/[0.09] text-primary">
            <Archive className="size-5" />
          </span>
          <p className="eyebrow mt-5">{t("Export.kicker")}</p>
          <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
            {t("Export.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("exportBlurb")}</p>
          <Button asChild className="mt-6">
            <a href="/api/me/export">
              <Download />
              {t("exportButton")}
            </a>
          </Button>
        </div>
        <div className="border-t border-border/70 bg-muted/30 px-6 py-7 sm:px-8 md:border-t-0 md:border-l">
          <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {t("Export.packingList")}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4">
            {PACKING_LIST.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm leading-8">
                <Check className="size-3.5 text-success" />
                {t(`Export.items.${item}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <DeleteAccount />
    </div>
  );
}

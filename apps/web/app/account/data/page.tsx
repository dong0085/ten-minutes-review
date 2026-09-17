import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteAccount } from "@/components/account/delete-account";
import { requireUser } from "@/lib/session";

export default async function AccountDataPage() {
  await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");

  return (
    <div className="space-y-7">
      <div className="border-b border-border/70 pb-7">
        <p className="eyebrow">{t("title")}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {tNav("data")}
        </h1>
      </div>

      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("exportBlurb")}</p>
          <Button asChild variant="outline" className="mt-3">
            <a href="/api/me/export">{t("exportButton")}</a>
          </Button>
          <div className="mt-4 border-t border-border pt-4">
            <DeleteAccount />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

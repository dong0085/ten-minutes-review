import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteAccount } from "@/components/account/delete-account";
import { requireUser } from "@/lib/session";
import { AccountHeader } from "@/components/account/account-header";

export default async function AccountDataPage() {
  await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");

  return (
    <div className="space-y-7">
      <AccountHeader title={tNav("data")} />

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

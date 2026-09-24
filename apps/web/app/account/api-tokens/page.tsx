import { getTranslations } from "next-intl/server";
import { listActiveApiTokensByUser } from "@tmr/db";
import { Card, CardContent } from "@/components/ui/card";
import { ApiTokens } from "@/components/account/api-tokens";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AccountHeader } from "@/components/account/account-header";

export default async function AccountApiTokensPage() {
  const user = await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");
  const rows = await listActiveApiTokensByUser(getDb(), user.id);

  return (
    <div className="space-y-7">
      <AccountHeader title={tNav("apiTokens")} />

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("ApiTokens.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("ApiTokens.blurb")}</p>
          <ApiTokens
            initialTokens={rows.map((row) => ({
              id: row.id,
              name: row.name,
              prefix: row.prefix,
              createdAt: row.createdAt,
              lastUsedAt: row.lastUsedAt,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { listActiveApiTokensByUser } from "@tmr/db";
import { Card, CardContent } from "@/components/ui/card";
import { ApiTokens } from "@/components/account/api-tokens";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function AccountApiTokensPage() {
  const user = await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");
  const rows = await listActiveApiTokensByUser(getDb(), user.id);

  return (
    <div className="space-y-7">
      <div className="border-b border-border/70 pb-7">
        <p className="eyebrow">{t("title")}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {tNav("apiTokens")}
        </h1>
      </div>

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

import { getTranslations } from "next-intl/server";
import { listActiveApiTokensByUser } from "@tmr/db";
import { AccountHeader } from "@/components/account/account-header";
import { ApiTokens } from "@/components/account/api-tokens";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function AccountApiTokensPage() {
  const user = await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");
  const rows = await listActiveApiTokensByUser(getDb(), user.id);

  return (
    <div className="space-y-10">
      <AccountHeader kicker={t("title")} title={tNav("apiTokens")} description={t("ApiTokens.blurb")} />
      <ApiTokens
        initialTokens={rows.map((row) => ({
          id: row.id,
          name: row.name,
          prefix: row.prefix,
          createdAt: row.createdAt,
          lastUsedAt: row.lastUsedAt,
        }))}
      />
    </div>
  );
}

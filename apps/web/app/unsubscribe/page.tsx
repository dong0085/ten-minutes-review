import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getUserById, upsertEmailPreferences } from "@tmr/db";
import { verifyUnsubscribeToken } from "@tmr/core/node";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const userId = token ? verifyUnsubscribeToken(token, env.authSecret) : null;
  const user = userId ? await getUserById(getDb(), userId) : null;
  const t = await getTranslations("Auth.UnsubscribePage");

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-[-0.035em]">{t("invalidTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("invalidBody")}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/account">{t("goToAccount")}</Link>
        </Button>
      </div>
    );
  }

  await upsertEmailPreferences(getDb(), user.id, {
    dailyEnabled: false,
    unsubscribedAt: new Date(),
  });

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-heading text-4xl font-semibold tracking-[-0.035em]">{t("successTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{t("successBody")}</p>
      <Button asChild className="mt-6">
        <Link href="/account">{t("manage")}</Link>
      </Button>
    </div>
  );
}

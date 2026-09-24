import { getTranslations } from "next-intl/server";
import { getAccountByProvider } from "@tmr/db";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleConnection } from "@/components/account/google-connection";
import { PasswordForm } from "@/components/account/password-form";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AccountHeader } from "@/components/account/account-header";

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");
  const params = await searchParams;
  const linkError = Array.isArray(params.linkError) ? params.linkError[0] : params.linkError;
  const googleAccount = await getAccountByProvider(getDb(), user.id, "google");

  return (
    <div className="space-y-7">
      <AccountHeader title={tNav("security")} />

      {linkError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {linkError === "email" ? t("Security.linkErrorEmail") : t("Security.linkErrorSession")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("Security.passwordTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {user.passwordHash ? t("Security.passwordBlurb") : t("Security.noPasswordBlurb")}
          </p>
          <PasswordForm hasPassword={Boolean(user.passwordHash)} />
        </CardContent>
      </Card>

      {process.env.GOOGLE_CLIENT_ID ? (
        <Card>
          <CardContent>
            <h2 className="font-heading text-xl font-semibold">
              {t("Security.connectionsTitle")}
            </h2>
            <p className="mt-2 text-sm font-medium">{t("Security.google")}</p>
            <GoogleConnection
              linked={Boolean(googleAccount)}
              hasPassword={Boolean(user.passwordHash)}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

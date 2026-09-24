import { getTranslations } from "next-intl/server";
import { KeyRound, LockKeyhole } from "lucide-react";
import { getAccountByProvider } from "@tmr/db";
import { AccountHeader, SectionTitle } from "@/components/account/account-header";
import { GoogleConnection } from "@/components/account/google-connection";
import { PasswordForm } from "@/components/account/password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

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
  const hasPassword = Boolean(user.passwordHash);
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  const signInMethods = Number(hasPassword) + Number(Boolean(googleAccount));

  return (
    <div className="space-y-10">
      <AccountHeader
        kicker={t("title")}
        title={tNav("security")}
        description={t("Pages.security")}
        aside={
          <p className="flex items-center gap-2 self-start rounded-full border border-border/80 bg-card px-3.5 py-1.5 text-xs font-medium sm:self-auto">
            <KeyRound className="size-3.5 text-primary" />
            {t("Security.methods", { count: signInMethods })}
          </p>
        }
      />

      {linkError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {linkError === "email" ? t("Security.linkErrorEmail") : t("Security.linkErrorSession")}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Password: a lock plate on the left, the form on the right. */}
      <section className="editorial-surface grid overflow-hidden rounded-[1.6rem] md:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="graph-paper flex flex-col items-center justify-center gap-3 border-b border-border/70 bg-muted/35 px-6 py-8 text-center md:border-r md:border-b-0">
          <span className="grid size-20 place-items-center rounded-[1.4rem] bg-primary text-primary-foreground shadow-[0_10px_24px_rgb(var(--shadow-colour)/0.16)]">
            <LockKeyhole className="size-9" strokeWidth={1.6} />
          </span>
          <p className="text-xs font-medium text-muted-foreground">
            {hasPassword ? t("Security.passwordOn") : t("Security.passwordOff")}
          </p>
        </div>
        <div className="px-6 py-6 sm:px-8">
          <SectionTitle title={t("Security.passwordTitle")} />
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            {hasPassword ? t("Security.passwordBlurb") : t("Security.noPasswordBlurb")}
          </p>
          <PasswordForm hasPassword={hasPassword} />
        </div>
      </section>

      {googleEnabled ? (
        <section>
          <SectionTitle kicker={t("Security.keyringKicker")} title={t("Security.connectionsTitle")} />
          <p className="mt-1 mb-5 text-sm text-muted-foreground">{t("Security.connectionsBlurb")}</p>
          <GoogleConnection linked={Boolean(googleAccount)} hasPassword={hasPassword} />
        </section>
      ) : null}
    </div>
  );
}

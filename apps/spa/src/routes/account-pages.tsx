import { useSearchParams } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Archive, Check, Download, KeyRound, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { AccountHeader, SectionTitle } from "@/components/account/account-header";
import { ApiTokens } from "@/components/account/api-tokens";
import { DeleteAccount } from "@/components/account/delete-account";
import { EmailPreferencesForm } from "@/components/account/email-preferences-form";
import { GoogleConnection } from "@/components/account/google-connection";
import { LibraryCard } from "@/components/account/library-card";
import { PasswordForm } from "@/components/account/password-form";
import { ProfileForm } from "@/components/account/profile-form";
import { ReferralPostcard } from "@/components/account/referral-postcard";
import { FullPageSpinner } from "@/app/shell";
import {
  useAccountOverview,
  useApiTokens,
  useEmailPreferences,
  useReferrals,
} from "@/lib/account";
import { formatResetTime } from "@/lib/send-time";
import { useSession } from "@/lib/session";

function useSignedInSession() {
  const { data } = useSession();
  return data && !data.isGuest ? data : null;
}

export function AccountProfilePage() {
  const t = useTranslations("Account");
  const tHub = useTranslations("App.AccountHub");
  const session = useSignedInSession();
  if (!session) {
    return <FullPageSpinner />;
  }
  return (
    <div className="space-y-10">
      <AccountHeader kicker={t("title")} title={tHub("profile")} description={t("Pages.profile")} />
      <ProfileForm
        defaultUsername={session.user.username}
        defaultUiLanguage={session.user.uiLanguage}
        defaultTimezone={session.user.timezone}
      />
    </div>
  );
}

export function AccountEmailPage() {
  const t = useTranslations("Account");
  const tHub = useTranslations("App.AccountHub");
  const locale = useLocale();
  const session = useSignedInSession();
  const { data: preferences } = useEmailPreferences();
  if (!session || !preferences) {
    return <FullPageSpinner />;
  }
  const reset = formatResetTime(locale, session.user.timezone);
  return (
    <div className="space-y-10">
      <AccountHeader
        kicker={t("title")}
        title={tHub("email")}
        description={t("EmailPreferencesForm.blurb")}
      />
      <EmailPreferencesForm
        defaultDailyEnabled={preferences.dailyEnabled}
        unsubscribedAt={preferences.unsubscribedAt}
        resetLocal={reset.local}
        resetUtc={reset.utc}
        resetTomorrow={reset.tomorrow}
      />
    </div>
  );
}

export function AccountSecurityPage() {
  const t = useTranslations("Account");
  const tHub = useTranslations("App.AccountHub");
  const [params] = useSearchParams();
  const linkError = params.get("linkError");
  const session = useSignedInSession();
  if (!session) {
    return <FullPageSpinner />;
  }
  const { hasPassword, googleLinked } = session;
  const signInMethods = Number(hasPassword) + Number(googleLinked);

  return (
    <div className="space-y-10">
      <AccountHeader
        kicker={t("title")}
        title={tHub("security")}
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

      {session.features.google ? (
        <section>
          <SectionTitle kicker={t("Security.keyringKicker")} title={t("Security.connectionsTitle")} />
          <p className="mt-1 mb-5 text-sm text-muted-foreground">{t("Security.connectionsBlurb")}</p>
          <GoogleConnection linked={googleLinked} hasPassword={hasPassword} />
        </section>
      ) : null}
    </div>
  );
}

export function AccountPlanPage() {
  const t = useTranslations("Account");
  const tHub = useTranslations("App.AccountHub");
  const [params] = useSearchParams();
  const session = useSignedInSession();
  const { data } = useAccountOverview();
  if (!session || !data) {
    return <FullPageSpinner />;
  }
  const { membership, usage } = data;
  return (
    <div className="space-y-10">
      <AccountHeader kicker={t("title")} title={tHub("plan")} description={tHub("planMeta")} />
      <LibraryCard
        user={{ ...session.user, createdAt: new Date(session.user.createdAt) }}
        billingEnabled={session.features.billing}
        usage={usage}
        membership={{
          ...membership,
          periodEnd: membership.periodEnd ? new Date(membership.periodEnd) : null,
          justSubscribed: params.get("billing") === "success",
        }}
      />
    </div>
  );
}

export function AccountReferralsPage() {
  const t = useTranslations("Account");
  const tHub = useTranslations("App.AccountHub");
  const { data } = useReferrals();
  if (!data) {
    return <FullPageSpinner />;
  }
  return (
    <div className="space-y-10">
      <AccountHeader kicker={t("title")} title={tHub("referrals")} description={t("shareBlurb")} />
      <ReferralPostcard
        code={data.code || null}
        shareUrl={data.shareUrl}
        referrals={data.referrals.map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt) }))}
      />
    </div>
  );
}

export function AccountTokensPage() {
  const t = useTranslations("Account");
  const { data: tokens } = useApiTokens();
  if (!tokens) {
    return <FullPageSpinner />;
  }
  return (
    <div className="space-y-10">
      <AccountHeader
        kicker={t("title")}
        title={t("ApiTokens.title")}
        description={t("ApiTokens.blurb")}
      />
      <ApiTokens
        initialTokens={tokens.map((token) => ({
          id: token.id,
          name: token.name ?? "",
          prefix: token.prefix,
          createdAt: new Date(token.createdAt),
          lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt) : null,
        }))}
      />
    </div>
  );
}

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

export function AccountDataPage() {
  const t = useTranslations("Account");
  const tHub = useTranslations("App.AccountHub");
  return (
    <div className="space-y-10">
      <AccountHeader kicker={t("title")} title={tHub("data")} description={t("Pages.data")} />

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

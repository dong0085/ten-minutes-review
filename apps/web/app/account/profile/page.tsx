import { getLocale, getTranslations } from "next-intl/server";
import { getEmailPreferences } from "@tmr/db";
import { AccountHeader } from "@/components/account/account-header";
import { EmailPreferencesForm } from "@/components/account/email-preferences-form";
import { ProfileForm } from "@/components/account/profile-form";
import { getDb } from "@/lib/db";
import { formatResetTime } from "@/lib/send-time";
import { requireUser } from "@/lib/session";

export default async function AccountProfilePage() {
  const user = await requireUser();
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");
  const locale = await getLocale();
  const reset = formatResetTime(locale, user.timezone);
  const preferences = await getEmailPreferences(getDb(), user.id);

  return (
    <div className="space-y-10">
      <AccountHeader kicker={t("title")} title={tNav("profile")} description={t("Pages.profile")} />

      <div className="space-y-8">
        <ProfileForm
          defaultUsername={user.username}
          defaultUiLanguage={user.uiLanguage}
          defaultTimezone={user.timezone}
        />
        <EmailPreferencesForm
          defaultDailyEnabled={preferences?.dailyEnabled ?? true}
          unsubscribedAt={
            preferences?.unsubscribedAt ? preferences.unsubscribedAt.toISOString() : null
          }
          resetLocal={reset.local}
          resetUtc={reset.utc}
          resetTomorrow={reset.tomorrow}
        />
      </div>
    </div>
  );
}

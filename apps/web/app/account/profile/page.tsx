import { getLocale, getTranslations } from "next-intl/server";
import { getEmailPreferences } from "@tmr/db";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-7">
      <div className="border-b border-border/70 pb-7">
        <p className="eyebrow">{t("title")}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {tNav("profile")}
        </h1>
      </div>

      <Card>
        <CardContent>
          <ProfileForm
            defaultUsername={user.username}
            defaultUiLanguage={user.uiLanguage}
            defaultTimezone={user.timezone}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("emailPreferencesSection")}</h2>
          <EmailPreferencesForm
            defaultDailyEnabled={preferences?.dailyEnabled ?? true}
            unsubscribedAt={
              preferences?.unsubscribedAt ? preferences.unsubscribedAt.toISOString() : null
            }
            resetLocal={reset.local}
            resetUtc={reset.utc}
            resetTomorrow={reset.tomorrow}
          />
        </CardContent>
      </Card>
    </div>
  );
}

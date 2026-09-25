
import { useState } from "react";
import { useRouter } from "@/lib/router";
import { useTranslations } from "use-intl";
import { MailCheck, MailX } from "lucide-react";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { readError } from "@/lib/read-error";
import { cn } from "@tmr/ui/utils";

// Daily email settings drawn as an envelope: a flap on top, a switch that
// saves as soon as it flips, and a postmark with the next delivery time.
export function EmailPreferencesForm({
  defaultDailyEnabled,
  unsubscribedAt,
  resetLocal,
  resetUtc,
  resetTomorrow,
}: {
  defaultDailyEnabled: boolean;
  unsubscribedAt: string | null;
  resetLocal: string;
  resetUtc: string;
  resetTomorrow: boolean;
}) {
  const t = useTranslations("Account.EmailPreferencesForm");
  const router = useRouter();
  const [dailyEnabled, setDailyEnabled] = useState(defaultDailyEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !dailyEnabled;
    setDailyEnabled(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/me/email-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dailyEnabled: next }),
      });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("error"));
      }
      setSaved(true);
      router.refresh();
    } catch (submitError) {
      setDailyEnabled(!next);
      setError(submitError instanceof Error ? submitError.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  const StatusIcon = dailyEnabled ? MailCheck : MailX;

  return (
    <section className="editorial-surface relative overflow-hidden rounded-[1.6rem]">
      {/* Envelope flap. */}
      <div
        aria-hidden="true"
        className="h-14 bg-muted/60 [clip-path:polygon(0_0,100%_0,50%_100%)]"
      />
      <div className="grid gap-6 px-6 pt-2 pb-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-8">
        <div>
          <p className="eyebrow">{t("kicker")}</p>
          <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("blurb")}</p>

          <button
            type="button"
            role="switch"
            aria-checked={dailyEnabled}
            onClick={() => void toggle()}
            disabled={saving}
            className="group mt-5 flex items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
          >
            <span
              className={cn(
                "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200",
                dailyEnabled ? "border-primary bg-primary" : "border-border bg-muted",
              )}
            >
              <span
                className={cn(
                  "size-5 rounded-full bg-card shadow-[0_1px_3px_rgb(var(--shadow-colour)/0.25)] transition-transform duration-200",
                  dailyEnabled ? "translate-x-6" : "translate-x-1",
                )}
              />
            </span>
            <span className="text-sm font-medium">{t("dailyToggle")}</span>
          </button>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <StatusIcon className={cn("size-3.5", dailyEnabled ? "text-success" : "")} />
            {saving ? t("savingShort") : saved ? t("saved") : dailyEnabled ? t("onBlurb") : t("offBlurb")}
          </p>
        </div>

        {/* Postmark with the next send time. */}
        <div
          className={cn(
            "mx-auto grid size-36 rotate-[-8deg] place-items-center rounded-full border-2 border-double text-center transition-opacity sm:mx-0",
            dailyEnabled ? "border-primary/60 text-primary" : "border-border text-muted-foreground opacity-60",
          )}
        >
          <div className="grid size-28 place-items-center rounded-full border border-current/40 px-2">
            <span>
              <span className="block text-[0.58rem] font-bold tracking-[0.16em] uppercase">
                {resetTomorrow ? t("postmarkTomorrow") : t("postmarkToday")}
              </span>
              <span className="mt-0.5 block font-heading text-2xl font-semibold tabular-nums">
                {resetLocal}
              </span>
              <span className="block text-[0.62rem] font-medium opacity-80">
                {t("postmarkUtc", { utc: resetUtc })}
              </span>
            </span>
          </div>
        </div>
      </div>

      {unsubscribedAt ? (
        <div className="px-6 pb-6 sm:px-8">
          <Alert>
            <AlertDescription>{t("unsubscribed")}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {error ? (
        <div className="px-6 pb-6 sm:px-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </section>
  );
}

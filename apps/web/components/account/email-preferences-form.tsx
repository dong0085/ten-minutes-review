"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { readError } from "@/lib/read-error";

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
  const tc = useTranslations("Common");
  const router = useRouter();
  const [dailyEnabled, setDailyEnabled] = useState(defaultDailyEnabled);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetFields = () => {
    setDailyEnabled(defaultDailyEnabled);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/me/email-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dailyEnabled }),
      });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("error"));
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-3 space-y-4">
        {unsubscribedAt ? (
          <Alert>
            <AlertDescription>{t("unsubscribed")}</AlertDescription>
          </Alert>
        ) : null}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("dailyLabel")}</dt>
            <dd className="mt-0.5 font-medium">{dailyEnabled ? t("on") : t("off")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("resetLabel")}</dt>
            <dd className="mt-0.5 font-medium">
              {resetTomorrow
                ? t("resetAtTomorrow", { local: resetLocal, utc: resetUtc })
                : t("resetAt", { local: resetLocal, utc: resetUtc })}
            </dd>
          </div>
        </dl>
        {saved ? (
          <Alert variant="success">
            <AlertDescription>{t("saved")}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          variant="outline"
          onClick={() => {
            resetFields();
            setSaved(false);
            setEditing(true);
          }}
        >
          {tc("edit")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4">
      {unsubscribedAt ? (
        <Alert>
          <AlertDescription>{t("unsubscribed")}</AlertDescription>
        </Alert>
      ) : null}
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={dailyEnabled}
          onChange={(event) => setDailyEnabled(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span>{t("dailyToggle")}</span>
      </label>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? tc("saving") : t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            resetFields();
            setEditing(false);
          }}
        >
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}

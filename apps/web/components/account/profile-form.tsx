"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe2, Languages, PencilLine } from "lucide-react";
import { UI_LOCALES } from "@tmr/core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { languageLabel } from "@/lib/language-label";
import { readError } from "@/lib/read-error";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded-xl border border-input/90 bg-card/55 px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25 disabled:opacity-50 dark:bg-input/20";

function timezoneOptions(current: string): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  const zones = supported ? supported("timeZone") : [];
  return zones.includes(current) ? zones : [current, ...zones];
}

export function ProfileForm({
  defaultUsername,
  defaultUiLanguage,
  defaultTimezone,
}: {
  defaultUsername: string | null;
  defaultUiLanguage: string;
  defaultTimezone: string;
}) {
  const t = useTranslations("Account.ProfileForm");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [username, setUsername] = useState(defaultUsername ?? "");
  const [uiLanguage, setUiLanguage] = useState(defaultUiLanguage);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The form only renders its fields after the user clicks Edit, so reading the
  // browser's timezone here never runs during server rendering.
  const deviceTimezone = editing ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  const resetFields = () => {
    setUsername(defaultUsername ?? "");
    setUiLanguage(defaultUiLanguage);
    setTimezone(defaultTimezone);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: username.trim() === "" ? null : username.trim(),
          uiLanguage,
          timezone: timezone.trim() === "" ? "UTC" : timezone.trim(),
        }),
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

  // A "Hello, my name is" sticker. The body swaps between the written-in
  // name and the edit form.
  return (
    <section className="editorial-surface overflow-hidden rounded-[1.6rem]">
      <div className="relative bg-primary px-6 pt-5 pb-4 text-center text-primary-foreground sm:px-8">
        <p className="font-heading text-4xl font-bold tracking-[0.08em] uppercase sm:text-5xl">
          {t("hello")}
        </p>
        <p className="mt-1 text-sm font-medium tracking-[0.12em] uppercase opacity-85">
          {t("myNameIs")}
        </p>
      </div>

      {!editing ? (
        <div className="px-6 pt-6 pb-6 sm:px-8">
          <p
            className={cn(
              "border-b-2 border-dashed border-border pb-2 text-center font-heading text-4xl font-semibold italic tracking-[-0.02em] sm:text-5xl",
              username.trim() === "" && "text-muted-foreground/60",
            )}
          >
            {username.trim() === "" ? t("notSet") : username}
          </p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-4 py-3">
              <Languages className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("interfaceLanguage")}</dt>
                <dd className="font-medium">{languageLabel(uiLanguage, locale)}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-4 py-3">
              <Globe2 className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("timezone")}</dt>
                <dd className="truncate font-medium">{timezone.replace(/_/g, " ")}</dd>
              </div>
            </div>
          </dl>
          {saved ? (
            <Alert variant="success" className="mt-4">
              <AlertDescription>{t("saved")}</AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                resetFields();
                setSaved(false);
                setEditing(true);
              }}
            >
              <PencilLine />
              {tc("edit")}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 px-6 pt-6 pb-6 sm:px-8">
          <div>
            <Label htmlFor="profile-username">{t("username")}</Label>
            <Input
              id="profile-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("usernamePlaceholder")}
              className="h-12 font-heading text-xl italic"
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="profile-language">{t("interfaceLanguage")}</Label>
              <select
                id="profile-language"
                value={uiLanguage}
                onChange={(event) => setUiLanguage(event.target.value)}
                className={selectClass}
              >
                {UI_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {languageLabel(code, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="profile-timezone">{t("timezone")}</Label>
              <select
                id="profile-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className={selectClass}
              >
                {timezoneOptions(timezone).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              {deviceTimezone && deviceTimezone !== timezone ? (
                <button
                  type="button"
                  className="mt-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setTimezone(deviceTimezone)}
                >
                  {t("useDeviceTimezone", { zone: deviceTimezone })}
                </button>
              ) : null}
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
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
      )}
    </section>
  );
}

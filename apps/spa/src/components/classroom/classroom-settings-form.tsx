
import { useState, type FormEvent } from "react";
import { useRouter } from "@/lib/router";
import { useLocale, useTranslations } from "use-intl";
import { LANGUAGES } from "@tmr/core";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { Input } from "@tmr/ui/components/input";
import { Label } from "@tmr/ui/components/label";
import { languageLabel } from "@/lib/language-label";

const selectClass =
  "h-10 w-full rounded-xl border border-input/90 bg-card/55 px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25 disabled:opacity-50 dark:bg-input/20";

export function ClassroomSettingsForm({
  classroom,
}: {
  classroom: {
    id: string;
    name: string;
    targetLanguage: string;
    nativeLanguage: string;
    autoStopDays: number;
  };
}) {
  const t = useTranslations("Classroom.SettingsForm");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState(classroom.name);
  const [targetLanguage, setTargetLanguage] = useState(classroom.targetLanguage);
  const [nativeLanguage, setNativeLanguage] = useState(classroom.nativeLanguage);
  const [autoStopDays, setAutoStopDays] = useState(String(classroom.autoStopDays));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  function touch() {
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const days = Number(autoStopDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      setError(t("daysRange"));
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/classrooms/${classroom.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, targetLanguage, nativeLanguage, autoStopDays: days }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("error"));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
        <h2 className="font-heading text-2xl font-semibold tracking-[-0.025em]">{t("title")}</h2>
        <div>
          <Label>{t("name")}</Label>
          <Input
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              touch();
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("learning")}</Label>
            <select
              className={selectClass}
              value={targetLanguage}
              onChange={(event) => {
                setTargetLanguage(event.target.value);
                touch();
              }}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {languageLabel(language.code, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("speak")}</Label>
            <select
              className={selectClass}
              value={nativeLanguage}
              onChange={(event) => {
                setNativeLanguage(event.target.value);
                touch();
              }}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {languageLabel(language.code, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label>{t("autoStop")}</Label>
          <Input
            type="number"
            min={1}
            max={90}
            required
            value={autoStopDays}
            onChange={(event) => {
              setAutoStopDays(event.target.value);
              touch();
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("autoStopHelp")}</p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {saved ? (
          <Alert variant="success">
            <AlertDescription>{t("saved")}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : t("saveChanges")}
        </Button>
        </form>
      </CardContent>
    </Card>
  );
}


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

export function NewClassroomForm({
  defaultNativeLanguage,
}: {
  defaultNativeLanguage: string;
}) {
  const t = useTranslations("Classroom.NewForm");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState(defaultNativeLanguage);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, targetLanguage, nativeLanguage }),
      });
      const body = (await response.json().catch(() => null)) as {
        classroom?: { id?: string };
        error?: string;
      } | null;
      if (response.ok && body?.classroom?.id) {
        router.push(`/classrooms/${body.classroom.id}`);
        router.refresh();
        return;
      }
      setError(body?.error ?? t("error"));
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/10 bg-card/80">
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label>{t("name")}</Label>
          <Input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div>
          <Label>{t("learning")}</Label>
          <select
            className={selectClass}
            required
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
          >
            <option value="" disabled>
              {t("chooseLanguage")}
            </option>
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
            required
            value={nativeLanguage}
            onChange={(event) => setNativeLanguage(event.target.value)}
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {languageLabel(language.code, locale)}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("creating") : t("create")}
        </Button>
        </form>
      </CardContent>
    </Card>
  );
}

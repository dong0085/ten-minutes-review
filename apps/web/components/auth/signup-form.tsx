"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { UI_LOCALES } from "@tmr/core";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { Input } from "@tmr/ui/components/input";
import { Label } from "@tmr/ui/components/label";
import { languageLabel } from "@/lib/language-label";
import { GoogleButton } from "./google-button";

const selectClass =
  "h-10 w-full rounded-xl border border-input/90 bg-card/55 px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25 disabled:opacity-50 dark:bg-input/20";

const subscribe = () => () => {};

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
}

function browserLanguage() {
  const code = navigator.language.slice(0, 2).toLowerCase();
  return UI_LOCALES.some((locale) => locale === code) ? code : "";
}

function writeReferralCookie(code: string) {
  document.cookie = `tmr_referral=${encodeURIComponent(code)}; path=/; max-age=3600`;
}

export function SignUpForm({ referralCode = "" }: { referralCode?: string }) {
  const t = useTranslations("Auth.SignUpForm");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [languageOverride, setLanguageOverride] = useState<string | null>(null);
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const detectedLanguage = useSyncExternalStore(subscribe, browserLanguage, () => "");
  const detectedTimezone = useSyncExternalStore(subscribe, browserTimezone, () => "");
  const uiLanguage = languageOverride ?? detectedLanguage;
  const timezone = timezoneOverride ?? detectedTimezone;

  useEffect(() => {
    if (referralCode) {
      writeReferralCookie(referralCode);
    }
  }, [referralCode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          referralCode: referralCode || undefined,
          timezone: timezone || undefined,
          uiLanguage: uiLanguage || undefined,
        }),
      });
      if (response.ok) {
        setDone(true);
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 409) {
        setError(t("emailTaken"));
      } else if (body?.error) {
        setError(body.error);
      } else {
        setError(t("genericError"));
      }
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Card className="border-primary/10 bg-card/80">
        <CardContent className="space-y-3">
          <h2 className="text-lg font-semibold">{t("checkEmailTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("checkEmailBody", { email })}</p>
          <Link className="text-sm font-medium underline" href="/signin">
            {t("goToSignIn")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10 bg-card/80">
      <CardContent className="space-y-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="signup-email">{t("email")}</Label>
            <Input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="signup-password">{t("password")}</Label>
            <Input
              id="signup-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="signup-language">{t("language")}</Label>
              <select
                id="signup-language"
                className={selectClass}
                value={uiLanguage}
                onChange={(event) => setLanguageOverride(event.target.value)}
              >
                <option value="">{t("browserDefault")}</option>
                {UI_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {languageLabel(code, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="signup-timezone">{t("timezone")}</Label>
              <Input
                id="signup-timezone"
                value={timezone}
                onChange={(event) => setTimezoneOverride(event.target.value)}
                placeholder="America/New_York"
              />
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("creating") : t("createAccount")}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("or")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton label={t("google")} />
        <p className="text-center text-sm text-muted-foreground">
          {t("alreadyHave")}{" "}
          <Link className="font-medium underline" href="/signin">
            {t("signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

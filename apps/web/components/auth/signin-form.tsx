"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { Input } from "@tmr/ui/components/input";
import { PasswordInput } from "@tmr/ui/components/password-input";
import { Label } from "@tmr/ui/components/label";
import { GoogleButton } from "./google-button";

function LastUsedBadge({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -top-2 right-3 rounded-full border border-primary/20 bg-card px-2 py-0.5 text-[11px] leading-none font-medium text-primary shadow-sm">
      {label}
    </span>
  );
}

export function SignInForm({
  callbackUrl,
  lastMethod,
}: {
  callbackUrl: string;
  lastMethod: "google" | "credentials" | null;
}) {
  const t = useTranslations("Auth.SignInForm");
  const tc = useTranslations("Common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError(t("invalid"));
        return;
      }
      // The signed-in app is a separate single-page app, so load it fresh.
      window.location.assign(callbackUrl);
    } catch {
      setError(tc("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/10 bg-card/80">
      <CardContent className="space-y-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="signin-email">{t("email")}</Label>
            <Input
              id="signin-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="signin-password">{t("password")}</Label>
            <PasswordInput
              id="signin-password"
              showLabel={tc("showPassword")}
              hideLabel={tc("hidePassword")}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="relative">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t("submitting") : t("submit")}
            </Button>
            {lastMethod === "credentials" ? <LastUsedBadge label={t("lastUsed")} /> : null}
          </div>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("or")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="relative">
          <GoogleButton label={t("google")} callbackUrl={callbackUrl} />
          {lastMethod === "google" ? <LastUsedBadge label={t("lastUsed")} /> : null}
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <Link className="underline" href="/forgot">
            {t("forgot")}
          </Link>
          <Link className="font-medium underline" href="/signup">
            {t("createAccount")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

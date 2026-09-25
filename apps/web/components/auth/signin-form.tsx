"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { Input } from "@tmr/ui/components/input";
import { Label } from "@tmr/ui/components/label";
import { GoogleButton } from "./google-button";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
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
            <Input
              id="signin-password"
              type="password"
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
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("or")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton label={t("google")} callbackUrl={callbackUrl} />
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

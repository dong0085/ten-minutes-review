"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { Input } from "@tmr/ui/components/input";
import { Label } from "@tmr/ui/components/label";

export function ForgotForm() {
  const t = useTranslations("Auth.ForgotForm");
  const tc = useTranslations("Common");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(tc("genericError"));
        return;
      }
      setDone(true);
    } catch {
      setError(tc("genericError"));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <Alert variant="success">
            <AlertDescription>{t("sent")}</AlertDescription>
          </Alert>
          <Link className="text-sm font-medium underline" href="/signin">
            {t("back")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
          <div>
            <Label htmlFor="forgot-email">{tc("email")}</Label>
            <Input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("sending") : t("submit")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link className="underline" href="/signin">
              {t("back")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

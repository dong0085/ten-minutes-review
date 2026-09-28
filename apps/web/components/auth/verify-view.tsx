"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Card, CardContent } from "@tmr/ui/components/card";

type VerifyResult = "loading" | "success" | "invalid";

const subscribe = () => () => {};

export function VerifyView() {
  const t = useTranslations("Auth.VerifyView");
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => null,
  );
  const [result, setResult] = useState<"success" | "invalid" | null>(null);
  const token = search === null ? "" : new URLSearchParams(search).get("token") ?? "";

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then((response) => {
        if (active) {
          setResult(response.ok ? "success" : "invalid");
        }
      })
      .catch(() => {
        if (active) {
          setResult("invalid");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  const state: VerifyResult =
    search === null ? "loading" : !token ? "invalid" : result ?? "loading";

  if (state === "loading") {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("verifying")}</p>
        </CardContent>
      </Card>
    );
  }

  if (state === "invalid") {
    return (
      <Card>
        <CardContent className="space-y-3">
          <Alert variant="destructive">
            <AlertDescription>
              {t("invalid")}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            {t("invalidHelp")}
          </p>
          <div className="flex gap-4 text-sm">
            <Link className="font-medium underline" href="/signin">
              {t("signIn")}
            </Link>
            <Link className="underline" href="/signup">
              {t("createAccount")}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <Alert variant="success">
          <AlertDescription>{t("success")}</AlertDescription>
        </Alert>
        <Link className="text-sm font-medium underline" href="/signin">
          {t("signIn")}
        </Link>
      </CardContent>
    </Card>
  );
}

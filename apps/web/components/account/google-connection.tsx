"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readError } from "@/lib/read-error";

export function GoogleConnection({
  linked,
  hasPassword,
}: {
  linked: boolean;
  hasPassword: boolean;
}) {
  const t = useTranslations("Account.Security");
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUnlink() {
    setRemoving(true);
    setError(null);
    try {
      const response = await fetch("/api/me/accounts/google", { method: "DELETE" });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("error"));
      }
      router.refresh();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : t("error"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={linked ? "success" : "secondary"}>
          {linked ? t("googleLinked") : t("googleNotLinked")}
        </Badge>
        {linked ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onUnlink()}
            disabled={removing || !hasPassword}
          >
            {removing ? t("unlinking") : t("unlinkGoogle")}
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route, not a page */}
            <a href="/api/auth/link/google">{t("linkGoogle")}</a>
          </Button>
        )}
        {linked && !hasPassword ? (
          <span className="text-xs text-muted-foreground">{t("unlinkNeedsPassword")}</span>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

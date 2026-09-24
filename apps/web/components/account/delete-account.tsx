"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { readError } from "@/lib/read-error";

export function DeleteAccount() {
  const t = useTranslations("Account.DeleteAccount");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/me", { method: "DELETE" });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("error"));
      }
      router.push("/");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("error"));
      setDeleting(false);
    }
  };

  if (!confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          {t("deleteAccount")}
        </Button>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertDescription>{t("warning")}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>
          {deleting ? t("deleting") : t("confirm")}
        </Button>
        <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
          {tc("cancel")}
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

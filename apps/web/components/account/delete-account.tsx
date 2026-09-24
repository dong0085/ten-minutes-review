"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Scissors, Trash2 } from "lucide-react";
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

  // A "cut here" strip below the rest of the page, with two-step confirm.
  return (
    <section className="pt-2">
      <div className="flex items-center gap-2 text-destructive/70">
        <Scissors className="size-4 -scale-x-100" />
        <span aria-hidden="true" className="cut-line h-2 flex-1" />
      </div>
      <div className="mt-5 rounded-[1.6rem] border border-destructive/25 bg-destructive/[0.035] px-6 py-6 sm:px-8">
        <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-destructive uppercase">
          {t("kicker")}
        </p>
        <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
          {t("deleteAccount")}
        </h2>
        {!confirming ? (
          <>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
            <Button variant="destructive" className="mt-5" onClick={() => setConfirming(true)}>
              <Trash2 />
              {t("deleteAccount")}
            </Button>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{t("warning")}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => void remove()}
                disabled={deleting}
              >
                {deleting ? t("deleting") : t("confirm")}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
                {tc("cancel")}
              </Button>
            </div>
          </div>
        )}
        {error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </section>
  );
}

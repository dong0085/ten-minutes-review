"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readError } from "@/lib/read-error";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("Account.Security");
  const tc = useTranslations("Common");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          hasPassword
            ? { currentPassword, newPassword: password }
            : { newPassword: password },
        ),
      });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("error"));
      }
      setSaved(true);
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 max-w-sm space-y-4">
      {hasPassword ? (
        <div>
          <Label htmlFor="password-current">{t("currentPassword")}</Label>
          <Input
            id="password-current"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
      ) : null}
      <div>
        <Label htmlFor="password-new">{t("newPassword")}</Label>
        <Input
          id="password-new"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="password-confirm">{t("confirmPassword")}</Label>
        <Input
          id="password-confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {saved ? (
        <Alert variant="success">
          <AlertDescription>{t("saved")}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={saving}>
        {saving ? tc("saving") : hasPassword ? t("change") : t("set")}
      </Button>
    </form>
  );
}

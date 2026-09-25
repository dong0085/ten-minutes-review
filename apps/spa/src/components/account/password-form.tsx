
import { useState, type FormEvent } from "react";
import { useTranslations } from "use-intl";
import { Check } from "lucide-react";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Input } from "@tmr/ui/components/input";
import { Label } from "@tmr/ui/components/label";
import { readError } from "@/lib/read-error";
import { cn } from "@tmr/ui/utils";

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

  const checks = [
    { label: t("checkLength"), ok: password.length >= 8 },
    { label: t("checkMatch"), ok: password.length > 0 && password === confirm },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
      {/* Checklist that ticks itself off while typing. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {checks.map((check) => (
          <li
            key={check.label}
            className={cn(
              "flex items-center gap-2 transition-colors",
              check.ok ? "text-success" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border transition-all duration-200",
                check.ok ? "scale-110 border-success bg-success text-card" : "border-border",
              )}
            >
              <Check className={cn("size-3 transition-opacity", check.ok ? "opacity-100" : "opacity-0")} />
            </span>
            {check.label}
          </li>
        ))}
      </ul>
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

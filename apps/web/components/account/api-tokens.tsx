"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

type CreatedToken = { token: string; name: string; prefix: string };

async function readError(response: Response): Promise<string | null> {
  const data: unknown = await response.json().catch(() => null);
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string") {
      return message;
    }
  }
  return null;
}

export function ApiTokens({ initialTokens }: { initialTokens: TokenRow[] }) {
  const t = useTranslations("Account.ApiTokens");
  const tc = useTranslations("Common");
  const format = useFormatter();
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateText = (date: Date) => format.dateTime(date, { dateStyle: "medium" });

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/me/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("error"));
      }
      const data = (await response.json()) as {
        token: string;
        info: { id: string; name: string; prefix: string };
      };
      setCreated({ token: data.token, name: data.info.name, prefix: data.info.prefix });
      setName("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t("error"));
    } finally {
      setCreating(false);
    }
  }

  async function onCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.token);
    setCopied(true);
  }

  function onDone() {
    setCreated(null);
    setCopied(false);
    router.refresh();
  }

  async function onRevoke(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/me/tokens/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("error"));
      }
      router.refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : t("error"));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="mt-3 space-y-5">
      {created ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium">{created.name}</p>
          <code className="mt-2 block overflow-x-auto rounded bg-card px-2 py-1.5 text-xs">
            {created.token}
          </code>
          <p className="mt-2 text-xs text-destructive">{t("revealWarning")}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void onCopy()}>
              {copied ? t("copied") : t("copy")}
            </Button>
            <Button size="sm" onClick={onDone}>
              {t("done")}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onCreate} className="flex max-w-sm items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="token-name">{t("nameLabel")}</Label>
            <Input
              id="token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={120}
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? tc("saving") : t("create")}
          </Button>
        </form>
      )}

      {initialTokens.length > 0 ? (
        <ul className="divide-y divide-border/70">
          {initialTokens.map((token) => (
            <li
              key={token.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
            >
              <div>
                <p className="text-sm font-medium">{token.name}</p>
                <code className="text-xs text-muted-foreground">{token.prefix}…</code>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("created", { date: dateText(token.createdAt) })} ·{" "}
                  {token.lastUsedAt
                    ? t("lastUsed", { date: dateText(token.lastUsedAt) })
                    : t("never")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onRevoke(token.id)}
                disabled={revokingId === token.id}
              >
                {t("revoke")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

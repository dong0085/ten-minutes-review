"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Copy, Plus, Ticket } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readError } from "@/lib/read-error";

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

type CreatedToken = { token: string; name: string; prefix: string };

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
    <div className="space-y-8">
      {created ? (
        // The fresh token: a highlighted ticket with a "shown once" stamp.
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary/[0.05] p-5 sm:p-6">
          <span className="ink-stamp absolute top-4 right-4 rounded-md px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.16em] text-destructive uppercase">
            {t("once")}
          </span>
          <p className="eyebrow">{t("newToken")}</p>
          <p className="mt-1 font-heading text-xl font-semibold">{created.name}</p>
          <code className="mt-4 block overflow-x-auto rounded-xl border border-border bg-card px-3 py-2.5 font-mono text-sm">
            {created.token}
          </code>
          <p className="mt-2 text-xs text-destructive">{t("revealWarning")}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void onCopy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? t("copied") : t("copy")}
            </Button>
            <Button size="sm" onClick={onDone}>
              {t("done")}
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={onCreate}
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4 sm:flex-row sm:items-end"
        >
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
            <Plus />
            {creating ? tc("saving") : t("create")}
          </Button>
        </form>
      )}

      {initialTokens.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {initialTokens.map((token) => (
            <li
              key={token.id}
              className="flex rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.06)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="min-w-0 flex-1 px-5 py-4">
                <p className="truncate font-medium">{token.name}</p>
                <code className="mt-1 block font-mono text-xs text-primary">{token.prefix}••••••</code>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("created", { date: dateText(token.createdAt) })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {token.lastUsedAt ? t("lastUsed", { date: dateText(token.lastUsedAt) }) : t("never")}
                </p>
              </div>
              {/* Tear line with a notch punched at each end. */}
              <span aria-hidden="true" className="relative flex w-px self-stretch">
                <span className="absolute -top-px left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-background [clip-path:inset(50%_0_0_0)]" />
                <span className="perforation my-3 flex-1" />
                <span className="absolute -bottom-px left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border border-border/80 bg-background [clip-path:inset(0_0_50%_0)]" />
              </span>
              <div className="grid place-items-center px-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void onRevoke(token.id)}
                  disabled={revokingId === token.id}
                >
                  {t("revoke")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <Ticket className="mx-auto size-8 -rotate-12 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

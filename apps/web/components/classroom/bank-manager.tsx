"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, RotateCcw, Search, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, type Category } from "@tmr/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BankItem, KnowledgePointJson } from "@/lib/bank";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "omitted" | "all";

const PAGE_SIZE = 60;

function matches(item: BankItem, query: string) {
  if (query === "") {
    return true;
  }
  return [item.targetText, item.nativeText, item.note].some((value) =>
    value?.toLocaleLowerCase().includes(query),
  );
}

export function BankManager({ initialItems }: { initialItems: BankItem[] }) {
  const t = useTranslations("Classroom.BankPage");
  const categoryT = useTranslations("Category");
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<BankItem | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  const activeCount = items.filter((item) => !item.isRetired).length;
  const omittedCount = items.length - activeCount;

  const statusMatches = useMemo(
    () =>
      items.filter((item) =>
        status === "all" ? true : status === "omitted" ? item.isRetired : !item.isRetired,
      ),
    [items, status],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const item of statusMatches) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [statusMatches]);
  const visible = useMemo(
    () =>
      statusMatches.filter(
        (item) => (category === "all" || item.category === category) && matches(item, deferredQuery),
      ),
    [statusMatches, category, deferredQuery],
  );

  function replaceItem(next: BankItem) {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  function setPending(id: string, pending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function toggleOmit(item: BankItem) {
    const omit = !item.isRetired;
    setPending(item.id, true);
    try {
      const response = await fetch(`/api/knowledge-points/${item.id}/omit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ omit }),
      });
      if (!response.ok) {
        throw new Error("Failed to update");
      }
      const body = (await response.json()) as {
        knowledgePoint: { isRetired: boolean; retiredAt: string | null };
      };
      replaceItem({
        ...item,
        isRetired: body.knowledgePoint.isRetired,
        retiredAt: body.knowledgePoint.retiredAt,
      });
      toast.success(omit ? t("omitSuccess") : t("restoreSuccess"));
    } catch {
      toast.error(t("toggleError"));
    } finally {
      setPending(item.id, false);
    }
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setStatus("all");
  }

  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: "active", label: t("statusActive"), count: activeCount },
    { value: "omitted", label: t("statusOmitted"), count: omittedCount },
    { value: "all", label: t("statusAll"), count: items.length },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="pl-9"
            />
          </div>
          <div
            role="radiogroup"
            aria-label={t("statusLabel")}
            className="flex shrink-0 gap-1 rounded-xl border border-border/70 bg-muted/45 p-1"
          >
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={status === option.value}
                onClick={() => {
                  setStatus(option.value);
                  setLimit(PAGE_SIZE);
                }}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition sm:flex-none",
                  status === option.value
                    ? "bg-card text-foreground shadow-[0_1px_3px_rgb(var(--shadow-colour)/0.08)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
                <span className="tabular-nums text-muted-foreground">{option.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div role="radiogroup" aria-label={t("categoryLabel")} className="flex flex-wrap gap-1.5">
          {(["all", ...CATEGORIES] as const).map((value) => {
            const selected = category === value;
            const count = value === "all" ? statusMatches.length : (categoryCounts.get(value) ?? 0);
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setCategory(value);
                  setLimit(PAGE_SIZE);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                  selected
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "all" ? t("allCategories") : categoryT(value)}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noMatches")}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
            {t("clearFilters")}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.slice(0, limit).map((item) => {
            const pending = pendingIds.has(item.id);
            return (
              <li
                key={item.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/75 p-4 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.035)] sm:flex-row sm:items-start sm:justify-between",
                  item.isRetired && "bg-muted/30",
                )}
              >
                <div className={cn("min-w-0 flex-1", item.isRetired && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{categoryT(item.category)}</Badge>
                    {item.isRetired ? <Badge variant="outline">{t("omittedBadge")}</Badge> : null}
                    {item.inferred ? (
                      <Badge variant="warning" title={t("inferredHint")}>
                        {t("inferredBadge")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[0.95rem] font-medium break-words">{item.targetText}</p>
                  {item.nativeText ? (
                    <p className="mt-0.5 text-sm break-words text-muted-foreground">
                      {item.nativeText}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1.5 text-xs leading-5 break-words text-muted-foreground">
                      {item.note}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[0.72rem] text-muted-foreground tabular-nums">
                    {item.answered > 0
                      ? t("stats", { answered: item.answered, missed: item.missed })
                      : t("notAsked")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                    <Pencil />
                    {t("edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => void toggleOmit(item)}
                    title={item.isRetired ? t("restoreHint") : t("omitHint")}
                  >
                    {pending ? (
                      <Loader2 className="animate-spin" />
                    ) : item.isRetired ? (
                      <RotateCcw />
                    ) : (
                      <EyeOff />
                    )}
                    {item.isRetired ? t("restore") : t("omit")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > limit ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            {t("showMore", { count: Math.min(PAGE_SIZE, visible.length - limit) })}
          </Button>
        </div>
      ) : null}

      <EditKnowledgePointDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          replaceItem(next);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditKnowledgePointDialog({
  item,
  onClose,
  onSaved,
}: {
  item: BankItem | null;
  onClose: () => void;
  onSaved: (item: BankItem) => void;
}) {
  const t = useTranslations("Classroom.BankPage");
  const tCommon = useTranslations("Common");

  return (
    <Dialog open={item !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{t("editBlurb")}</DialogDescription>
        </DialogHeader>
        {item ? (
          <EditKnowledgePointForm
            key={item.id}
            item={item}
            cancelLabel={tCommon("cancel")}
            saveLabel={tCommon("save")}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditKnowledgePointForm({
  item,
  cancelLabel,
  saveLabel,
  onCancel,
  onSaved,
}: {
  item: BankItem;
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSaved: (item: BankItem) => void;
}) {
  const t = useTranslations("Classroom.BankPage");
  const [targetText, setTargetText] = useState(item.targetText);
  const [nativeText, setNativeText] = useState(item.nativeText ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (targetText.trim() === "") {
      setError(t("targetRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/knowledge-points/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetText, nativeText, note }),
      });
      if (!response.ok) {
        throw new Error("Failed to save");
      }
      const body = (await response.json()) as { knowledgePoint: KnowledgePointJson };
      onSaved({ ...body.knowledgePoint, answered: item.answered, missed: item.missed });
      toast.success(t("saveSuccess"));
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="bank-target">{t("targetLabel")}</Label>
        <Input
          id="bank-target"
          value={targetText}
          onChange={(event) => setTargetText(event.target.value)}
          maxLength={2000}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bank-native">{t("nativeLabel")}</Label>
        <Input
          id="bank-native"
          value={nativeText}
          onChange={(event) => setNativeText(event.target.value)}
          maxLength={2000}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bank-note">{t("noteLabel")}</Label>
        <Textarea
          id="bank-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>
      {item.sourceExcerpt ? (
        <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
          <p className="text-[0.72rem] font-medium text-muted-foreground">{t("sourceLabel")}</p>
          <p className="mt-1 text-xs leading-5 whitespace-pre-wrap text-muted-foreground">
            {item.sourceExcerpt}
          </p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : saveLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
